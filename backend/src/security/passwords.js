import crypto from 'node:crypto';

/**
 * Hash de contraseñas con scrypt (función "memory-hard" incluida en Node, recomendada por
 * OWASP junto con Argon2id). Formato guardado:  scrypt$<log2N>$<r>$<p>$<sal>$<hash>
 *
 * - Costo por defecto N = 2^17, r = 8, p = 1 (≈128 MiB por cálculo), configurable con
 *   PASSWORD_HASH_COST (las pruebas automáticas usan un costo menor para ir rápido).
 * - Se siguen aceptando los hashes antiguos PBKDF2 "sal:hash" para no dejar a nadie por
 *   fuera; `needsRehash` indica cuándo hay que actualizarlos (se hace al iniciar sesión).
 * - Una contraseña guardada en texto plano NUNCA se acepta.
 */

const KEY_LENGTH = 32;
const R = 8;
const P = 1;

function costLog2() {
  const value = Number(process.env.PASSWORD_HASH_COST || 17);
  return Number.isInteger(value) && value >= 12 && value <= 20 ? value : 17;
}

function scrypt(password, salt, log2N, r = R, p = P) {
  const N = 2 ** log2N;
  return crypto.scryptSync(String(password).normalize('NFKC'), salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 });
}

export function hashPassword(password) {
  const log2N = costLog2();
  const salt = crypto.randomBytes(16);
  const hash = scrypt(password, salt, log2N);
  return `scrypt$${log2N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function safeEqual(a, b) {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || password === undefined || password === null) return false;
  const value = String(storedHash);
  try {
    if (value.startsWith('scrypt$')) {
      const [, log2N, r, p, saltB64, hashB64] = value.split('$');
      const expected = Buffer.from(hashB64, 'base64');
      const actual = scrypt(password, Buffer.from(saltB64, 'base64'), Number(log2N), Number(r), Number(p));
      return safeEqual(actual, expected);
    }
    // Formato anterior (PBKDF2-SHA256, 100 000 iteraciones): sal:hash en hexadecimal.
    if (/^[0-9a-f]+:[0-9a-f]+$/i.test(value)) {
      const [saltHex, hashHex] = value.split(':');
      const expected = Buffer.from(hashHex, 'hex');
      const actual = crypto.pbkdf2Sync(String(password), Buffer.from(saltHex, 'hex'), 100000, expected.length, 'sha256');
      return safeEqual(actual, expected);
    }
  } catch {
    return false;
  }
  return false; // texto plano u otro formato desconocido: se rechaza
}

/** ¿El hash es antiguo o tiene un costo menor al configurado? Entonces se recalcula al ingresar. */
export function needsRehash(storedHash) {
  const value = String(storedHash || '');
  if (!value.startsWith('scrypt$')) return true;
  const [, log2N, r, p] = value.split('$');
  return Number(log2N) < costLog2() || Number(r) !== R || Number(p) !== P;
}

/** ¿Este valor parece un hash conocido? (sirve para migrar contraseñas que quedaron en texto plano). */
export function isPasswordHash(value) {
  const text = String(value || '');
  return text.startsWith('scrypt$') || /^[0-9a-f]{16,}:[0-9a-f]{32,}$/i.test(text);
}
