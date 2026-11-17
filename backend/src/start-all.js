// Inicia todos los microservicios y el API Gateway con un solo comando: npm start
// Cada microservicio crea/abre su propia base de datos en data/db/<servicio>.sqlite.
//
// Este archivo es además el SUPERVISOR de los microservicios (tolerancia a fallos):
//  - Si un microservicio se cae solo (error), lo vuelve a levantar a los 3 segundos.
//  - Si se apaga A PROPÓSITO (desde la consola del administrador o escribiendo
//    "detener pqrs" en esta terminal), queda apagado y los demás siguen funcionando.
//  - Con --con-frontend el gateway también sirve la página ya compilada (carpeta dist/),
//    así todo queda en UNA sola dirección (sirve para publicar el sitio con un link).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { GATEWAY_PORT, SERVICES } from './config.js';
import { loadedEnvFiles } from './env.js';
import { getNotificationMode } from './notification-providers.js';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const withFrontend = process.argv.includes('--con-frontend');

if (withFrontend && !process.env.STATIC_DIR) {
  const dist = path.resolve(srcDir, '..', '..', 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('\nNo existe la carpeta dist/. Primero compila la página: en la carpeta raíz ejecuta  npm run build\n');
    process.exit(1);
  }
  process.env.STATIC_DIR = dist;
}

// Credenciales de correo/SMS/WhatsApp: backend/.env (copia de .env.example). Las carga env.js.
if (loadedEnvFiles.length) console.log(`Variables cargadas desde ${loadedEnvFiles.join(', ')}.`);
if (getNotificationMode() !== 'live') console.log('Notificaciones SIMULADAS: no llegan al correo ni a WhatsApp. Crea backend/.env (ver backend/.env.example).');

const FILES = {
  users: 'users-service.js',
  auth: 'auth-service.js',
  content: 'content-service.js',
  notifications: 'notifications-service.js',
  healthcare: 'healthcare-service.js',
  pqrs: 'pqrs-service.js',
  'meds-labs': 'meds-labs-service.js',
  gateway: 'gateway.js',
};
const MICROSERVICES = Object.keys(FILES).filter(name => name !== 'gateway');

// Minutos tras los cuales un servicio apagado desde la consola web se enciende solo
// (así nadie deja la página pública "rota"). 0 = nunca. Los apagados desde la terminal no se reencienden.
const AUTO_RECOVER_MINUTES = Math.max(0, Number(process.env.AUTO_RECOVER_MINUTES ?? 10));

/** Estado de cada proceso: running | stopped | restarting. */
const procs = Object.fromEntries(Object.keys(FILES).map(name => [name, {
  child: null, state: 'stopped', manual: false, stoppedBy: null, stoppedAt: null, recoverAt: null, recoverTimer: null, crashes: [],
}]));

function start(name) {
  const proc = procs[name];
  if (proc.child) return false;
  clearTimeout(proc.recoverTimer);
  Object.assign(proc, { manual: false, stoppedBy: null, stoppedAt: null, recoverAt: null, recoverTimer: null, state: 'running' });
  // El canal "ipc" permite que el gateway le pida al supervisor apagar o encender servicios.
  const child = spawn(process.execPath, [path.join(srcDir, FILES[name])], {
    cwd: path.join(srcDir, '..'), env: process.env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const label = `[${name}]`.padEnd(16);
  const print = stream => chunk => String(chunk).split(/\r?\n/).filter(Boolean).forEach(line => stream.write(`${label}${line}\n`));
  child.stdout.on('data', print(process.stdout));
  child.stderr.on('data', print(process.stderr));
  if (name === 'gateway') child.on('message', message => handleGatewayMessage(child, message));
  child.on('exit', code => {
    proc.child = null;
    if (shuttingDown) return;
    if (proc.manual) {
      proc.state = 'stopped';
      console.log(`${label}APAGADO (${proc.stoppedBy}). Los demás microservicios siguen funcionando.`);
      return;
    }
    // Caída inesperada: se reinicia solo (máximo 5 veces por minuto para no quedar en un ciclo).
    const now = Date.now();
    proc.crashes = proc.crashes.filter(time => now - time < 60000).concat(now);
    if (proc.crashes.length > 5) {
      proc.state = 'stopped';
      proc.stoppedBy = 'falla repetida';
      console.error(`${label}se cayó ${proc.crashes.length} veces en un minuto; queda apagado. Revisa el error de arriba y escribe "iniciar ${name}".`);
      return;
    }
    proc.state = 'restarting';
    console.error(`${label}se detuvo con código ${code}. Se reinicia en 3 segundos (autorrecuperación).`);
    setTimeout(() => { if (procs[name].state === 'restarting') start(name); }, 3000).unref();
  });
  proc.child = child;
  return true;
}

function stop(name, { by = 'terminal', minutes = 0 } = {}) {
  const proc = procs[name];
  if (!proc.child) return false;
  Object.assign(proc, { manual: true, stoppedBy: by, stoppedAt: new Date().toISOString() });
  if (minutes > 0) {
    proc.recoverAt = new Date(Date.now() + minutes * 60000).toISOString();
    proc.recoverTimer = setTimeout(() => {
      console.log(`[supervisor]     ${name} se enciende solo (pasaron ${minutes} min desde que se apagó).`);
      start(name);
    }, minutes * 60000);
    proc.recoverTimer.unref();
  }
  const child = proc.child;
  child.kill('SIGTERM');
  // Si no termina en 3 s, se fuerza.
  setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 3000).unref();
  return true;
}

function snapshot() {
  return MICROSERVICES.map(name => {
    const { state, stoppedBy, stoppedAt, recoverAt } = procs[name];
    return { name, port: SERVICES[name].port, process: state, stoppedBy, stoppedAt, recoverAt };
  });
}

// ---------- Órdenes que llegan del gateway (consola web del administrador) ----------
function handleGatewayMessage(child, message) {
  if (!message || typeof message !== 'object' || !message.id) return;
  const reply = body => { try { child.send({ id: message.id, ...body }); } catch { /* gateway reiniciando */ } };
  const { type, name, by } = message;
  if (type === 'services:list') return reply({ ok: true, items: snapshot(), autoRecoverMinutes: AUTO_RECOVER_MINUTES });
  if (!MICROSERVICES.includes(name)) return reply({ ok: false, error: 'Microservicio desconocido.' });
  if (type === 'service:stop') {
    const done = stop(name, { by: `consola web (${String(by || 'administrador').slice(0, 60)})`, minutes: AUTO_RECOVER_MINUTES });
    console.log(`[supervisor]     ${by || 'Administrador'} apagó ${name} desde la consola web.`);
    return reply({ ok: true, changed: done, items: snapshot(), autoRecoverMinutes: AUTO_RECOVER_MINUTES });
  }
  if (type === 'service:start') {
    const done = start(name);
    console.log(`[supervisor]     ${by || 'Administrador'} encendió ${name} desde la consola web.`);
    return reply({ ok: true, changed: done, items: snapshot(), autoRecoverMinutes: AUTO_RECOVER_MINUTES });
  }
  return reply({ ok: false, error: 'Orden desconocida.' });
}

// Si quedó abierto un backend anterior, los puertos están ocupados y seguiría respondiendo la versión vieja.
const portInUse = port => new Promise(resolve => {
  const tester = net.createServer().once('error', () => resolve(true)).once('listening', () => tester.close(() => resolve(false)));
  tester.listen(port);
});
const ports = [GATEWAY_PORT, ...Object.values(SERVICES).map(service => service.port)];
const busy = [];
for (const port of ports) if (await portInUse(port)) busy.push(port);
if (busy.length) {
  console.error(`\nYa hay un backend corriendo (puertos ocupados: ${busy.join(', ')}).`);
  console.error('Cierra la otra ventana del backend (o termina los procesos "node") y vuelve a ejecutar este comando.\n');
  process.exit(1);
}

let shuttingDown = false;
// DISABLED_SERVICES=pqrs,content arranca el backend con esos microservicios apagados (para demostraciones).
const disabledAtStart = new Set(String(process.env.DISABLED_SERVICES || '').split(',').map(item => item.trim()).filter(Boolean));
Object.keys(FILES).forEach(name => {
  if (disabledAtStart.has(name) && name !== 'gateway') {
    Object.assign(procs[name], { state: 'stopped', manual: true, stoppedBy: 'DISABLED_SERVICES', stoppedAt: new Date().toISOString() });
  } else {
    start(name);
  }
});

const waitFor = async (port, attempts = 60) => {
  for (let i = 0; i < attempts; i += 1) {
    if (await portInUse(port)) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
};
await Promise.all([GATEWAY_PORT, ...MICROSERVICES.filter(name => procs[name].child).map(name => SERVICES[name].port)].map(port => waitFor(port)));
console.log(`\nBackend listo. Verifica en http://localhost:${GATEWAY_PORT}/api/health`);
if (process.env.STATIC_DIR) console.log(`Página web servida por el gateway en http://localhost:${GATEWAY_PORT}`);
if (disabledAtStart.size) console.log(`Apagados al iniciar (DISABLED_SERVICES): ${[...disabledAtStart].join(', ')}`);
console.log('Escribe "ayuda" para apagar o encender microservicios desde esta ventana.\n');

// ---------- Órdenes escritas en la terminal ----------
const HELP = `Órdenes disponibles:
  estado              muestra qué microservicios están encendidos
  detener <servicio>  apaga un microservicio (los demás siguen funcionando)
  iniciar <servicio>  lo vuelve a encender
  reiniciar <servicio>
  salir               apaga todo el backend
Servicios: ${MICROSERVICES.join(', ')}`;

if (process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', line => {
    const [command = '', name = ''] = line.trim().toLowerCase().split(/\s+/);
    if (!command) return;
    if (['ayuda', 'help', '?'].includes(command)) return console.log(HELP);
    if (['estado', 'status'].includes(command)) {
      return snapshot().forEach(item => console.log(`  ${item.name.padEnd(14)} ${item.process === 'running' ? 'ENCENDIDO' : 'APAGADO'}  (puerto ${item.port})`));
    }
    if (['salir', 'exit'].includes(command)) return shutdown();
    if (!MICROSERVICES.includes(name)) return console.log(`Servicio desconocido "${name}". ${HELP}`);
    if (['detener', 'apagar', 'stop'].includes(command)) return console.log(stop(name) ? `Apagando ${name}…` : `${name} ya estaba apagado.`);
    if (['iniciar', 'encender', 'start'].includes(command)) return console.log(start(name) ? `Encendiendo ${name}…` : `${name} ya estaba encendido.`);
    if (['reiniciar', 'restart'].includes(command)) {
      stop(name);
      setTimeout(() => start(name), 1500);
      return console.log(`Reiniciando ${name}…`);
    }
    return console.log(HELP);
  });
}

function shutdown() {
  shuttingDown = true;
  Object.values(procs).forEach(proc => proc.child?.kill());
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
