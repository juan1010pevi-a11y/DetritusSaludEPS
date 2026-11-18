import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Gestión de secretos.
 *
 * - En PRODUCCIÓN (NODE_ENV=production) cada secreto es obligatorio: si falta o es débil
 *   (muy corto o con el valor de ejemplo "change-this…"), el microservicio NO arranca.
 * - En DESARROLLO, si falta un secreto se genera uno aleatorio y se guarda en
 *   <DATA_DIR>/.dev-secrets.json (carpeta ignorada por Git). Todos los microservicios que
 *   comparten DATA_DIR leen el mismo archivo, así los tokens firmados por auth-service
 *   son válidos en los demás. Nunca hay un secreto fijo escrito en el código.
 */

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SECRET_SPECS = {
  AUTH_SECRET: { minLength: 32, generate: () => crypto.randomBytes(48).toString('base64url') },
  INTERNAL_KEY: { minLength: 32, generate: () => crypto.randomBytes(48).toString('base64url') },
  // Llave AES-256 (32 bytes) en base64 para cifrar campos sensibles.
  DATA_KEY: { minLength: 44, generate: () => crypto.randomBytes(32).toString('base64') },
};

const WEAK_PATTERNS = [/^change-this/i, /^detritus-/i, /^secret$/i, /^test-secret$/i];

export const isProduction = () => process.env.NODE_ENV === 'production';

function devSecretsFile() {
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(backendDir, 'data', 'db'));
  return path.join(dataDir, '.dev-secrets.json');
}

let devCache = null;
let warned = false;

/** Lee (o crea de forma atómica) el archivo de secretos de desarrollo. */
function devSecrets() {
  if (devCache) return devCache;
  const file = devSecretsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    const generated = Object.fromEntries(Object.entries(SECRET_SPECS).map(([name, spec]) => [name, spec.generate()]));
    const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(generated, null, 2), { mode: 0o600 });
    try {
      fs.linkSync(temp, file); // atómico: si otro proceso lo creó primero, se usa el suyo
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }
  devCache = JSON.parse(fs.readFileSync(file, 'utf8'));
  return devCache;
}

export function secretProblem(name, value) {
  const { minLength = 32 } = SECRET_SPECS[name] || {};
  if (!value) return `${name} no está definido`;
  if (value.length < minLength) return `${name} es demasiado corto (mínimo ${minLength} caracteres)`;
  if (WEAK_PATTERNS.some(pattern => pattern.test(value))) return `${name} tiene un valor de ejemplo`;
  return null;
}

/**
 * Devuelve el secreto `name`. En producción falla si no es fuerte; en desarrollo usa uno
 * generado automáticamente y lo avisa una sola vez.
 */
export function requireSecret(name) {
  const value = process.env[name];
  const problem = secretProblem(name, value);
  if (!problem) return value;
  if (isProduction()) {
    throw new Error(`Configuración insegura: ${problem}. Defínelo en las variables de entorno (ver .env.example).`);
  }
  const secrets = devSecrets();
  if (!secrets[name]) throw new Error(`No se pudo generar el secreto de desarrollo ${name}.`);
  if (!warned) {
    console.warn(`[seguridad] Modo desarrollo: secretos sin configurar; se usan los generados en ${devSecretsFile()}.`);
    warned = true;
  }
  return secrets[name];
}
