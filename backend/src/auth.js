import { json } from './service.js';
import { requireSecret } from './security/secrets.js';
import { signJwt, verifyJwt } from './security/tokens.js';

/**
 * Tokens de acceso: JWT HS256 de vida corta (15 minutos por defecto, ACCESS_TOKEN_MINUTES).
 * La sesión larga la mantiene un refresh token en cookie HttpOnly (ver auth-service.js),
 * que sí se puede revocar al cerrar sesión o cambiar la contraseña.
 */
const tokenSecret = requireSecret('AUTH_SECRET');
export const TOKEN_ISSUER = 'detritus-auth';
export const TOKEN_AUDIENCE = 'detritus-api';
export const MFA_AUDIENCE = 'detritus-mfa';
const ACCESS_TOKEN_SECONDS = Math.min(Math.max(Number(process.env.ACCESS_TOKEN_MINUTES || 15), 1), 60) * 60;

export const ROLE_LABELS = {
  affiliate: 'Afiliado',
  doctor: 'Médico',
  administrator: 'Administrador',
};

/** Perfiles que ven datos de muchos pacientes: pueden exigir verificación en dos pasos. */
export const STAFF_ROLES = ['doctor', 'administrator'];
export const mfaRequiredForStaff = () => process.env.MFA_REQUIRED_FOR_STAFF === '1';

export function signToken({ id, name, document, role, roles, mfa = false }) {
  return signJwt({ sub: id, name, document, role, roles, mfa: Boolean(mfa) }, {
    secret: tokenSecret,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresInSeconds: ACCESS_TOKEN_SECONDS,
  });
}

/** Token temporal (5 min) entre "contraseña correcta" y "código de 2 pasos correcto". */
export function signMfaChallenge({ id, role }) {
  return signJwt({ sub: id, role }, { secret: tokenSecret, issuer: TOKEN_ISSUER, audience: MFA_AUDIENCE, expiresInSeconds: 300 });
}

export function verifyMfaChallenge(token) {
  return verifyJwt(token, { secret: tokenSecret, issuer: TOKEN_ISSUER, audience: MFA_AUDIENCE });
}

export function getAuthenticatedUser(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const claims = verifyJwt(match[1], { secret: tokenSecret, issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE });
  if (!claims || typeof claims.sub !== 'string' || !claims.role) return null;
  return claims;
}

/**
 * Exige una sesión válida cuyo perfil ACTIVO esté dentro de `roles`.
 * Si `roles` está vacío basta con estar autenticado.
 * Con MFA_REQUIRED_FOR_STAFF=1, médico y administrador deben haber ingresado con 2 pasos.
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
  if (mfaRequiredForStaff() && STAFF_ROLES.includes(user.role) && !user.mfa) {
    json(res, 403, { error: 'Activa la verificación en dos pasos para usar el perfil de médico o administrador.', mfaSetupRequired: true });
    return null;
  }
  return user;
}

/**
 * Control de acceso por DUEÑO del recurso: el usuario solo accede a lo suyo, salvo los
 * perfiles listados en `roles` (por defecto el administrador).
 */
export function requireOwnerOrRole(req, res, ownerId, roles = ['administrator']) {
  const user = requireRole(req, res);
  if (!user) return null;
  if ((ownerId && user.sub === ownerId) || roles.includes(user.role)) return user;
  json(res, 403, { error: 'No tienes permiso para ver o modificar este recurso.' });
  return null;
}
