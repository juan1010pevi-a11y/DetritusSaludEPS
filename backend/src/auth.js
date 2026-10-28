import crypto from 'node:crypto';
import { json } from './service.js';

// Secreto compartido por todos los microservicios para firmar y validar tokens.
const tokenSecret = process.env.AUTH_SECRET || 'detritus-academic-secret';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // jornada laboral: 8 horas

export const ROLE_LABELS = {
  affiliate: 'Afiliado',
  doctor: 'Médico',
  administrator: 'Administrador',
};

export function signToken({ id, name, document, role, roles }) {
  const payload = Buffer.from(JSON.stringify({
    sub: id,
    name,
    document,
    role,
    roles,
    exp: Date.now() + TOKEN_TTL_MS,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function getAuthenticatedUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  if (signature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return user.exp > Date.now() ? user : null;
  } catch {
    return null;
  }
}

/**
 * Exige una sesión válida cuyo perfil ACTIVO esté dentro de `roles`.
 * Si `roles` está vacío basta con estar autenticado.
 */
export function requireRole(req, res, roles = []) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    json(res, 401, { error: 'Tu sesión expiró o no has iniciado sesión.' });
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    const allowed = roles.map(role => ROLE_LABELS[role] || role).join(' o ');
    json(res, 403, { error: `Esta acción requiere ingresar con perfil ${allowed}.` });
    return null;
  }
  return user;
}
