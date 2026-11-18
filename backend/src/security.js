// Compatibilidad: el hash de contraseñas ahora vive en security/passwords.js (scrypt).
export { hashPassword, verifyPassword, needsRehash, isPasswordHash } from './security/passwords.js';
