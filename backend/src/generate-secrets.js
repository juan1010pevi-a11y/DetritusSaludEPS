// Genera secretos fuertes para el archivo .env:  npm run generar-secretos
// Copia la salida en el .env junto a docker-compose.yml (nunca lo subas a GitHub).
import crypto from 'node:crypto';

const lines = [
  `AUTH_SECRET=${crypto.randomBytes(48).toString('base64url')}`,
  `INTERNAL_KEY=${crypto.randomBytes(48).toString('base64url')}`,
  `DATA_KEY=${crypto.randomBytes(32).toString('base64')}`,
  'RABBITMQ_USER=detritus_app',
  `RABBITMQ_PASS=${crypto.randomBytes(24).toString('hex')}`,
];
console.log(lines.join('\n'));
