import crypto from 'node:crypto';

export function hashPassword(password, salt = crypto.randomBytes(16)) {
  const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt), 'utf8');
  const key = crypto.pbkdf2Sync(String(password), saltBuffer, 100000, 32, 'sha256');
  return `${saltBuffer.toString('hex')}:${key.toString('hex')}`;
}

export function hashPasswordWithSeed(password) {
  const seed = process.env.PASSWORD_SALT || 'detritus-default-salt';
  const salt = Buffer.from(seed, 'utf8').subarray(0, 16);
  return hashPassword(password, salt);
}

export function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (!storedHash.includes(':')) return String(password) === storedHash;

  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256');
  return crypto.timingSafeEqual(Buffer.from(hashHex, 'hex'), expected);
}
