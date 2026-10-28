import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const SERVICES = ['users-service.js', 'auth-service.js', 'content-service.js', 'notifications-service.js',
  'healthcare-service.js', 'pqrs-service.js', 'meds-labs-service.js', 'gateway.js'];

/**
 * Levanta TODO el backend (7 microservicios + gateway) en puertos de prueba, con una
 * carpeta temporal de bases de datos, sin RabbitMQ y con la fecha fija del lunes
 * 2 de noviembre de 2026 a las 6:00 a. m.
 */
export async function startBackend({ basePort = 5600, fakeNow = '2026-11-02T06:00' } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detritus-test-'));
  const env = {
    ...process.env,
    BASE_PORT: String(basePort),
    DATA_DIR: dataDir,
    RABBITMQ_DISABLED: '1',
    NOTIFICATIONS_MODE: 'mock',
    FAKE_NOW: fakeNow,
    AUTH_SECRET: 'test-secret',
  };
  const logs = [];
  const children = SERVICES.map(file => {
    const child = spawn(process.execPath, [path.join(srcDir, file)], { env, cwd: path.join(srcDir, '..') });
    child.stdout.on('data', chunk => logs.push(`[${file}] ${chunk}`));
    child.stderr.on('data', chunk => logs.push(`[${file}] ${chunk}`));
    return child;
  });
  const base = `http://localhost:${basePort}/api`;
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) break;
    } catch { /* todavía arrancando */ }
    if (Date.now() > deadline) {
      children.forEach(child => child.kill());
      throw new Error(`El backend no arrancó a tiempo:\n${logs.join('')}`);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async function api(pathname, { method = 'GET', body, token, headers = {} } = {}) {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  }

  async function login(document, password, role) {
    const { status, data } = await api('/auth/login', { method: 'POST', body: { document, password, role } });
    if (status !== 200) throw new Error(`No se pudo iniciar sesión con ${document}: ${data?.error}`);
    return data.token;
  }

  /** Repite `check` hasta que devuelva algo verdadero (para eventos asíncronos). */
  async function eventually(check, timeout = 5000) {
    const limit = Date.now() + timeout;
    for (;;) {
      const value = await check();
      if (value) return value;
      if (Date.now() > limit) return value;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  async function stop() {
    await Promise.all(children.map(child => new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      child.kill('SIGTERM');
    })));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  return { api, login, eventually, stop, dataDir, logs };
}
