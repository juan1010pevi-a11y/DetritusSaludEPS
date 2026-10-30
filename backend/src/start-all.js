// Inicia todos los microservicios y el API Gateway con un solo comando: npm start
// Cada microservicio crea/abre su propia base de datos en data/db/<servicio>.sqlite.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATEWAY_PORT, SERVICES } from './config.js';
import { loadedEnvFiles } from './env.js';
import { getNotificationMode } from './notification-providers.js';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
// Credenciales de correo/SMS/WhatsApp: backend/.env (copia de .env.example). Las carga env.js.
if (loadedEnvFiles.length) console.log(`Variables cargadas desde ${loadedEnvFiles.join(', ')}.`);
if (getNotificationMode() !== 'live') console.log('Notificaciones SIMULADAS: no llegan al correo ni a WhatsApp. Crea backend/.env (ver backend/.env.example).');
const services = [
  ['users', 'users-service.js'],
  ['auth', 'auth-service.js'],
  ['content', 'content-service.js'],
  ['notifications', 'notifications-service.js'],
  ['healthcare', 'healthcare-service.js'],
  ['pqrs', 'pqrs-service.js'],
  ['meds-labs', 'meds-labs-service.js'],
  ['gateway', 'gateway.js'],
];
const children = [];

function start(name, file) {
  const child = spawn(process.execPath, [path.join(srcDir, file)], { cwd: path.join(srcDir, '..'), env: process.env });
  const label = `[${name}]`.padEnd(16);
  const print = stream => chunk => String(chunk).split(/\r?\n/).filter(Boolean).forEach(line => stream.write(`${label}${line}\n`));
  child.stdout.on('data', print(process.stdout));
  child.stderr.on('data', print(process.stderr));
  child.on('exit', code => { if (code) console.error(`${label}se detuvo con código ${code}. Revisa el error de arriba.`); });
  children.push(child);
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

// Como cada servicio tiene su propia base, ya no hay que esperar a que uno cree la base de los demás.
services.forEach(service => start(...service));

const waitFor = async (port, attempts = 60) => {
  for (let i = 0; i < attempts; i += 1) {
    if (await portInUse(port)) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
};
await Promise.all(ports.map(port => waitFor(port)));
console.log(`\nBackend listo. Verifica en http://localhost:${GATEWAY_PORT}/api/health\n`);

const stop = () => { children.forEach(child => child.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
