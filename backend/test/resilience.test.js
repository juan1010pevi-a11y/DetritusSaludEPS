import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBackend } from './helpers.js';

/**
 * Tolerancia a fallos: si se apaga un microservicio, los demás siguen funcionando
 * y el gateway responde 503 SOLO para la parte que depende del servicio apagado.
 */

const BASE_PORT = 5700;
const port = offset => BASE_PORT + offset; // auth 1, users 2, content 3, notifications 4, healthcare 5, pqrs 6, meds-labs 7

describe('Un microservicio apagado no tumba a los demás', () => {
  let backend;
  let api;
  let affiliate;
  let admin;

  before(async () => {
    backend = await startBackend({ basePort: BASE_PORT });
    api = backend.api;
    affiliate = await backend.login('123456789', 'demo123', 'affiliate');
    admin = await backend.login('900000002', 'admin123', 'administrator');
  });

  after(async () => { await backend?.stop(); });

  test('con PQRS apagado: PQRS responde 503 claro y citas y noticias siguen funcionando', async () => {
    await backend.killService('pqrs-service.js');

    const pqrs = await api('/pqrs/requests/mine', { token: affiliate });
    assert.equal(pqrs.status, 503);
    assert.equal(pqrs.data.unavailable, true);
    assert.equal(pqrs.data.service, 'pqrs');
    assert.match(pqrs.data.error, /El resto del portal sigue funcionando/);

    assert.equal((await api('/healthcare/appointments/mine', { token: affiliate })).status, 200);
    assert.equal((await api('/healthcare/specialties')).status, 200);
    assert.equal((await api('/content/news')).status, 200);
    assert.equal((await api('/meds-labs/prescriptions/mine', { token: affiliate })).status, 200);

    const health = await api('/health');
    assert.equal(health.status, 503);
    assert.equal(health.data.status, 'degradado');
    assert.deepEqual(health.data.down, ['pqrs']);
  });

  test('la consola del administrador muestra qué servicio está apagado y su impacto', async () => {
    const forbidden = await api('/admin/services', { token: affiliate });
    assert.equal(forbidden.status, 403);
    const anonymous = await api('/admin/services');
    assert.equal(anonymous.status, 401);

    const response = await api('/admin/services', { token: admin });
    assert.equal(response.status, 200);
    assert.equal(response.data.control, 'docker'); // en las pruebas no hay supervisor
    const pqrs = response.data.items.find(item => item.name === 'pqrs');
    assert.equal(pqrs.status, 'apagado');
    assert.ok(pqrs.impact.length > 10);
    assert.equal(response.data.items.find(item => item.name === 'healthcare').status, 'ok');
  });

  test('PQRS vuelve a funcionar al encenderlo, sin reiniciar los demás', async () => {
    await backend.reviveService('pqrs-service.js', port(6));
    assert.equal((await api('/pqrs/requests/mine', { token: affiliate })).status, 200);
    const health = await api('/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');
  });

  test('con usuarios, notificaciones y contenidos apagados se puede seguir radicando una PQRSD', async () => {
    await backend.killService('users-service.js');
    await backend.killService('notifications-service.js');
    await backend.killService('content-service.js');

    const response = await api('/pqrs/requests', {
      method: 'POST',
      body: {
        type: 'Petición', subject: 'Prueba de tolerancia a fallos', name: 'Ana Ruiz', document: '52123456',
        email: 'ana@example.com', phone: '3001112222', description: 'Solicitud radicada con tres microservicios apagados.', acceptDataPolicy: true,
      },
    });
    assert.equal(response.status, 201, response.data?.error);
    assert.equal((await api('/healthcare/specialties')).status, 200);
    assert.equal((await api('/content/news')).status, 503);

    // El token ya emitido sigue siendo válido: cada servicio lo verifica sin llamar a auth/users.
    assert.equal((await api('/healthcare/appointments/mine', { token: affiliate })).status, 200);

    await backend.reviveService('users-service.js', port(2));
    await backend.reviveService('notifications-service.js', port(4));
    await backend.reviveService('content-service.js', port(3));
    assert.equal((await api('/health')).status, 200);
  });
});

describe('Supervisor (npm start): apagar y encender desde la consola web', () => {
  const SUP_PORT = 5900;
  const base = `http://localhost:${SUP_PORT}/api`;
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
  let child;
  let dataDir;
  const logs = [];

  const call = async (pathname, { method = 'GET', body, token } = {}) => {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json().catch(() => null) };
  };
  const waitUntil = async (check, timeout = 15000) => {
    const limit = Date.now() + timeout;
    while (Date.now() < limit) {
      try { if (await check()) return true; } catch { /* arrancando */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  };

  before(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detritus-sup-'));
    child = spawn(process.execPath, [path.join(srcDir, 'start-all.js')], {
      cwd: path.join(srcDir, '..'),
      env: {
        ...process.env, BASE_PORT: String(SUP_PORT), DATA_DIR: dataDir, RABBITMQ_DISABLED: '1', NOTIFICATIONS_MODE: 'mock',
        DETRITUS_SKIP_ENV_FILE: '1', PASSWORD_HASH_COST: '14', AUTO_RECOVER_MINUTES: '0', PORT: '',
        RATE_LIMIT_GENERAL: '100000', RATE_LIMIT_AUTH: '100000', RATE_LIMIT_PUBLIC_LOOKUP: '100000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => logs.push(String(chunk)));
    child.stderr.on('data', chunk => logs.push(String(chunk)));
    const ready = await waitUntil(async () => (await fetch(`${base}/health`)).ok, 30000);
    assert.ok(ready, `El supervisor no arrancó:\n${logs.join('')}`);
  });

  after(async () => {
    if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
  });

  test('el administrador apaga PQRS, los demás siguen y luego lo enciende', async () => {
    const login = await call('/auth/login', { method: 'POST', body: { document: '900000002', password: 'admin123', role: 'administrator' } });
    assert.equal(login.status, 200, login.data?.error);
    const token = login.data.token;

    const list = await call('/admin/services', { token });
    assert.equal(list.data.control, 'supervisor');

    const stopped = await call('/admin/services/pqrs/stop', { method: 'POST', token });
    assert.equal(stopped.status, 200, stopped.data?.error);
    assert.ok(await waitUntil(async () => (await call('/pqrs/requests/mine', { token })).status === 503));
    assert.equal((await call('/healthcare/specialties')).status, 200);
    assert.equal((await call('/content/news')).status, 200);

    // Apagado a propósito: el supervisor NO lo reinicia solo.
    await new Promise(resolve => setTimeout(resolve, 3500));
    assert.equal((await call('/pqrs/requests/mine', { token })).status, 503);

    const started = await call('/admin/services/pqrs/start', { method: 'POST', token });
    assert.equal(started.status, 200);
    assert.ok(await waitUntil(async () => (await call('/pqrs/requests/mine', { token })).status === 200));
  });

  test('si un microservicio se cae por un error, el supervisor lo levanta solo', async () => {
    // Simula una caída: se termina el proceso de contenidos "desde afuera" (como un error fatal).
    const pid = await new Promise(resolve => {
      const finder = spawn('sh', ['-c', `lsof -ti tcp:${SUP_PORT + 3} -sTCP:LISTEN || fuser ${SUP_PORT + 3}/tcp 2>/dev/null`]);
      let out = '';
      finder.stdout.on('data', chunk => { out += chunk; });
      finder.on('exit', () => resolve(Number(out.trim().split(/\s+/)[0]) || null));
      finder.on('error', () => resolve(null));
    });
    if (!pid) return; // sin lsof/fuser (Windows): se omite esta comprobación
    process.kill(pid, 'SIGKILL');
    assert.ok(await waitUntil(async () => (await call('/content/news')).status === 503, 3000) || true);
    assert.ok(await waitUntil(async () => (await call('/content/news')).status === 200, 15000), `No se recuperó:\n${logs.join('')}`);
  });
});
