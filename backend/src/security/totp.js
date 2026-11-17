import crypto from 'node:crypto';

/**
 * Verificación en dos pasos con TOTP (RFC 6238), compatible con Google Authenticator,
 * Microsoft Authenticator, Authy, etc. Implementado con node:crypto (HMAC-SHA1, 6 dígitos,
 * pasos de 30 s). Se acepta ±1 paso para tolerar desfase de reloj y no se permite reutilizar
 * un código ya usado (`lastStep`).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

export function hotp(secret, counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(code).padStart(DIGITS, '0');
}

export const totp = (secret, now = Date.now()) => hotp(secret, currentStep(now));

/** Devuelve el paso de tiempo que coincidió (para impedir reutilizarlo) o null. */
export function verifyTotp(secret, code, { lastStep = -1, window = 1, now = Date.now() } = {}) {
  const value = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(value)) return null;
  const step = currentStep(now);
  for (let delta = -window; delta <= window; delta += 1) {
    const candidate = step + delta;
    if (candidate <= lastStep) continue;
    const expected = Buffer.from(hotp(secret, candidate));
    if (crypto.timingSafeEqual(expected, Buffer.from(value))) return candidate;
  }
  return null;
}

export function otpauthUri(secret, accountName, issuer = 'Detritus Salud EPS') {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
