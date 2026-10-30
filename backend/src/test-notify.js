import './env.js';
import { channelProblems, configuredChannels, deliverNotification, getNotificationMode } from './notification-providers.js';
import { emailError, normalizePhone, phoneError } from './validators.js';

/**
 * Prueba rápida de credenciales, sin abrir la página:
 *   npm run probar-notificaciones -- tu.correo@gmail.com 3001234567
 * Envía un mensaje de prueba por correo y por WhatsApp (y SMS si está configurado)
 * y muestra el error exacto si algo falla.
 */
const args = process.argv.slice(2);
const email = args.find(arg => arg.includes('@'));
const phone = args.map(normalizePhone).find(arg => /^3\d{9}$/.test(arg));

if (!email && !phone) {
  console.log('Uso: npm run probar-notificaciones -- <correo> <celular>');
  console.log('Ej.: npm run probar-notificaciones -- tu.correo@gmail.com 3001234567');
  process.exit(1);
}
if (email && emailError(email)) { console.error(emailError(email)); process.exit(1); }
if (args.some(arg => !arg.includes('@')) && !phone) { console.error(phoneError(args.find(arg => !arg.includes('@')))); process.exit(1); }

const startupMode = getNotificationMode(); // el modo real del backend, antes de forzar el envío de prueba
process.env.NOTIFICATIONS_MODE = 'live';
const channels = configuredChannels();
console.log(`Canales con credenciales: ${Object.entries(channels).map(([name, ok]) => `${name}=${ok ? 'sí' : 'no'}`).join(', ')}`);
channelProblems().forEach(problem => console.log(`  · ${problem}`));

const body = 'Detritus Salud EPS: mensaje de prueba. Si lo recibes, las notificaciones están funcionando.';
const jobs = [];
if (email) jobs.push(['email', email]);
if (phone) jobs.push(['whatsapp', phone], ['sms', phone]);

let failed = false;
for (const [channel, to] of jobs) {
  try {
    const result = await deliverNotification({ channel, to, subject: 'Prueba de notificaciones - Detritus Salud', body });
    const label = { sent: 'ENVIADO', skipped: 'omitido (sin credenciales)' }[result.status] || result.status;
    console.log(`${channel.padEnd(8)} → ${to}: ${label}${result.reference && result.status === 'sent' ? ` (${result.reference})` : ''}`);
  } catch (error) {
    failed = true;
    console.log(`${channel.padEnd(8)} → ${to}: ERROR · ${error.message}`);
  }
}
console.log(`\nModo con el que arrancará el backend: ${startupMode === 'live' ? 'LIVE (envío real)' : 'MOCK (simulado)'}.`);
process.exit(failed ? 1 : 0);
