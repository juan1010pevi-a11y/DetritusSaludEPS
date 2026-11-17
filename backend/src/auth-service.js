import './env.js'; // primero: credenciales de backend/.env
import crypto from 'node:crypto';
import { startService, json, readJson, readCookies } from './service.js';
import { createDatabase } from './database.js';
import {
  getAuthenticatedUser, mfaRequiredForStaff, ROLE_LABELS, signMfaChallenge, signToken, STAFF_ROLES, verifyMfaChallenge,
} from './auth.js';
import { callService, personByDocument } from './internal.js';
import { publishEvent } from './broker.js';
import { hashPassword, verifyPassword } from './security.js';
import { getNotificationMode } from './notification-providers.js';
import { codeError, documentError, maskContact, passwordError } from './validators.js';
import { isProduction } from './security/secrets.js';
import { randomToken, sha256 } from './security/tokens.js';
import { open, seal } from './security/crypto-fields.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from './security/totp.js';
import { object, oneOf, optional, parse, string } from './security/schema.js';

const db = await createDatabase('auth');
const { queryOne, queryRows, execute } = db;

const MAX_FAILED_LOGINS = 5;           // intentos fallidos permitidos…
const LOCK_MINUTES = 15;               // …en esta ventana de tiempo
const RESET_CODE_MINUTES = 15;         // vigencia del código de recuperación
const MAX_RESET_ATTEMPTS = 5;
const RESET_COOLDOWN_SECONDS = 60;     // evita enviar códigos en ráfaga
const REFRESH_HOURS = Math.min(Math.max(Number(process.env.REFRESH_TOKEN_HOURS || 8), 1), 24 * 7); // jornada laboral
const REFRESH_COOKIE = 'detritus_rt';
const ROTATION_GRACE_SECONDS = Number(process.env.REFRESH_REUSE_GRACE_SECONDS ?? 30); // dos pestañas que refrescan a la vez no se consideran robo

const ROLES = Object.keys(ROLE_LABELS);
const DocumentField = string({ min: 1, max: 20, label: 'El documento' });
const LoginSchema = object({
  document: DocumentField,
  password: string({ min: 1, max: 128, label: 'La contraseña', trim: false }),
  role: optional(oneOf(ROLES, 'El perfil')),
});
const CodeField = string({ min: 6, max: 6, pattern: /^\d{6}$/, label: 'El código' });

const minutesAgo = minutes => new Date(Date.now() - minutes * 60000).toISOString();
const documentProblem = value => documentError(value, /[A-Za-z]/.test(value) ? 'PA' : 'CC');

async function loadUser(userId) {
  const data = await callService('users', `/internal/people?ids=${encodeURIComponent(userId)}`);
  return data.items[0] || null;
}

async function doctorProfile(userId) {
  try {
    const data = await callService('healthcare', `/internal/doctors?id=${encodeURIComponent(userId)}`);
    return data.doctor ? { specialty: data.doctor.specialty, site: data.doctor.site, license: data.doctor.license } : null;
  } catch {
    return null;
  }
}

// ---------- Cookies y refresh tokens ----------

function cookieHeader(value, maxAgeSeconds) {
  const secure = isProduction() || process.env.COOKIE_SECURE === '1';
  return [
    `${REFRESH_COOKIE}=${value}`,
    'Path=/api/auth',
    'HttpOnly',               // JavaScript no puede leerla (protección ante XSS)
    'SameSite=Strict',        // no viaja en peticiones de otros sitios (protección ante CSRF)
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

function issueRefreshToken(req, { userId, role, mfa, familyId = crypto.randomUUID() }) {
  const token = randomToken(32);
  const now = new Date();
  execute(
    `INSERT INTO refresh_tokens (token_hash, family_id, user_id, role, mfa, created_at, expires_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sha256(token), familyId, userId, role, mfa ? 1 : 0, now.toISOString(),
      new Date(now.getTime() + REFRESH_HOURS * 3600000).toISOString(), String(req.headers['user-agent'] || '').slice(0, 200)],
  );
  return cookieHeader(token, REFRESH_HOURS * 3600);
}

const clearCookie = () => cookieHeader('', 0);

function revokeUserSessions(userId, reason) {
  execute('UPDATE refresh_tokens SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL',
    [new Date().toISOString(), reason, userId]);
}

async function sessionResponse(res, req, user, role, { mfa = false, familyId, status = 200 } = {}) {
  const publicUser = {
    id: user.id,
    name: user.name,
    document: user.document,
    role,
    roles: user.roles,
    doctor: user.roles.includes('doctor') ? await doctorProfile(user.id) : null,
    mfa: Boolean(mfa),
    mfaEnabled: mfaEnabled(user.id),
    mfaSetupRequired: mfaRequiredForStaff() && STAFF_ROLES.includes(role) && !mfa,
  };
  const cookie = issueRefreshToken(req, { userId: user.id, role, mfa, familyId });
  return json(res, status, { token: signToken(publicUser), user: publicUser }, { 'Set-Cookie': cookie });
}

// ---------- Verificación en dos pasos ----------

const mfaRow = userId => queryOne('SELECT secret, pending_secret AS pendingSecret, enabled_at AS enabledAt, last_step AS lastStep FROM user_mfa WHERE user_id = ?', [userId]);
const mfaEnabled = userId => Boolean(mfaRow(userId)?.enabledAt);

function checkTotp(userId, code, field = 'secret') {
  const row = mfaRow(userId);
  const secret = row && open(row[field]);
  if (!secret) return false;
  const step = verifyTotp(secret, code, { lastStep: field === 'secret' ? row.lastStep : -1 });
  if (step === null) return false;
  execute('UPDATE user_mfa SET last_step = ?, updated_at = ? WHERE user_id = ?', [step, new Date().toISOString(), userId]);
  return true;
}

function failedAttempts(key) {
  return queryOne('SELECT COUNT(*) AS total FROM login_attempts WHERE document = ? AND success = 0 AND attempted_at > ?',
    [key, minutesAgo(LOCK_MINUTES)]).total;
}

const recordAttempt = (key, success) => execute(
  'INSERT INTO login_attempts (document, success, attempted_at) VALUES (?, ?, ?)', [key, success ? 1 : 0, new Date().toISOString()],
);

startService({
  name: 'auth-service',
  serviceKey: 'auth',
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'auth-service', status: 'ok', database: db.file }),
    },
    {
      method: 'POST',
      path: '/login',
      handler: async (req, res) => {
        const { document: value, password, role } = parse(LoginSchema, await readJson(req));
        const problem = documentProblem(value);
        if (problem) return json(res, 400, { error: problem });

        // Bloqueo temporal por fuerza bruta: 5 intentos fallidos en 15 minutos.
        const failed = failedAttempts(value);
        if (failed >= MAX_FAILED_LOGINS) {
          return json(res, 429, { error: `Demasiados intentos fallidos. Espera ${LOCK_MINUTES} minutos o usa “¿Olvidaste tu contraseña?”.` });
        }

        let user = null;
        try {
          user = (await callService('users', '/internal/credentials/verify', { method: 'POST', body: { document: value, password } })).user;
        } catch (error) {
          if (error.status !== 401) throw error;
        }
        recordAttempt(value, Boolean(user));
        if (!user) {
          const left = MAX_FAILED_LOGINS - failed - 1;
          return json(res, 401, { error: `Documento o contraseña incorrectos.${left > 0 && left <= 2 ? ` Te quedan ${left} intento(s).` : ''}` });
        }
        if (user.status !== 'active') {
          return json(res, 403, { error: 'Tu cuenta no está activa. Comunícate con la línea de atención.' });
        }
        if (!user.roles.length) return json(res, 403, { error: 'Tu cuenta no tiene perfiles de acceso asignados.' });
        if (role && !user.roles.includes(role)) {
          const available = user.roles.map(item => ROLE_LABELS[item]).join(', ');
          return json(res, 403, {
            error: `Este documento no tiene perfil de ${ROLE_LABELS[role] || role}. Perfiles disponibles: ${available}.`,
            roles: user.roles,
          });
        }
        const activeRole = role || user.roles[0];
        // Médico y administrador con 2 pasos activado: falta el código de la app autenticadora.
        if (STAFF_ROLES.includes(activeRole) && mfaEnabled(user.id)) {
          return json(res, 200, { mfaRequired: true, mfaToken: signMfaChallenge({ id: user.id, role: activeRole }) });
        }
        return sessionResponse(res, req, user, activeRole);
      },
    },
    {
      // Paso 2 del ingreso con verificación en dos pasos.
      method: 'POST',
      path: '/mfa/verify',
      handler: async (req, res) => {
        const { mfaToken, code } = parse(object({ mfaToken: string({ min: 1, max: 2048, label: 'El token' }), code: CodeField }), await readJson(req));
        const challenge = verifyMfaChallenge(mfaToken);
        if (!challenge) return json(res, 401, { error: 'La verificación venció. Ingresa de nuevo con tu documento y contraseña.' });
        const key = `mfa:${challenge.sub}`;
        if (failedAttempts(key) >= MAX_FAILED_LOGINS) {
          return json(res, 429, { error: `Demasiados códigos incorrectos. Espera ${LOCK_MINUTES} minutos.` });
        }
        const ok = checkTotp(challenge.sub, code);
        recordAttempt(key, ok);
        if (!ok) return json(res, 401, { error: 'El código de verificación no es correcto o ya fue usado.' });
        const user = await loadUser(challenge.sub);
        if (!user || user.status !== 'active' || !user.roles.includes(challenge.role)) return json(res, 401, { error: 'Tu cuenta ya no es válida.' });
        return sessionResponse(res, req, user, challenge.role, { mfa: true });
      },
    },
    {
      // Renueva el token de acceso con el refresh token de la cookie (rotación en cada uso).
      method: 'POST',
      path: '/refresh',
      handler: async (req, res) => {
        const token = readCookies(req)[REFRESH_COOKIE];
        if (!token) return json(res, 401, { error: 'No hay una sesión activa.' });
        const row = queryOne(
          `SELECT token_hash AS hash, family_id AS familyId, user_id AS userId, role, mfa, expires_at AS expiresAt,
                  revoked_at AS revokedAt, revoked_reason AS revokedReason
           FROM refresh_tokens WHERE token_hash = ?`,
          [sha256(token)],
        );
        if (!row) return json(res, 401, { error: 'Tu sesión no es válida. Ingresa de nuevo.' }, { 'Set-Cookie': clearCookie() });
        if (row.revokedAt) {
          const recentRotation = row.revokedReason === 'rotated'
            && Date.now() - new Date(row.revokedAt).getTime() < ROTATION_GRACE_SECONDS * 1000;
          if (!recentRotation) {
            // Un refresh token ya usado volvió a aparecer: posible robo. Se cierra toda la familia de sesiones.
            execute('UPDATE refresh_tokens SET revoked_at = ?, revoked_reason = ? WHERE family_id = ? AND revoked_at IS NULL',
              [new Date().toISOString(), 'reuse-detected', row.familyId]);
            console.warn(`[seguridad] reutilización de refresh token detectada para el usuario ${row.userId}; sesiones revocadas.`);
            return json(res, 401, { error: 'Tu sesión se cerró por seguridad. Ingresa de nuevo.' }, { 'Set-Cookie': clearCookie() });
          }
          return json(res, 409, { error: 'La sesión se está renovando. Intenta de nuevo.' });
        }
        if (new Date(row.expiresAt).getTime() < Date.now()) {
          return json(res, 401, { error: 'Tu sesión expiró. Ingresa de nuevo.' }, { 'Set-Cookie': clearCookie() });
        }
        const user = await loadUser(row.userId);
        if (!user || user.status !== 'active' || !user.roles.includes(row.role)) {
          revokeUserSessions(row.userId, 'account-changed');
          return json(res, 401, { error: 'Tu sesión ya no es válida.' }, { 'Set-Cookie': clearCookie() });
        }
        execute("UPDATE refresh_tokens SET revoked_at = ?, revoked_reason = 'rotated' WHERE token_hash = ?", [new Date().toISOString(), row.hash]);
        return sessionResponse(res, req, user, row.role, { mfa: Boolean(row.mfa), familyId: row.familyId });
      },
    },
    {
      method: 'POST',
      path: '/logout',
      handler: async (req, res) => {
        const token = readCookies(req)[REFRESH_COOKIE];
        if (token) {
          execute("UPDATE refresh_tokens SET revoked_at = ?, revoked_reason = 'logout' WHERE token_hash = ? AND revoked_at IS NULL",
            [new Date().toISOString(), sha256(token)]);
        }
        return json(res, 200, { loggedOut: true }, { 'Set-Cookie': clearCookie() });
      },
    },
    {
      // Una persona con varios perfiles (p. ej. afiliada y médica) cambia de perfil sin volver a escribir su contraseña.
      method: 'POST',
      path: '/switch-role',
      handler: async (req, res) => {
        const current = getAuthenticatedUser(req);
        if (!current) return json(res, 401, { error: 'Tu sesión expiró. Ingresa de nuevo.' });
        const { role } = parse(object({ role: oneOf(ROLES, 'El perfil') }), await readJson(req));
        const user = await loadUser(current.sub);
        if (!user || user.status !== 'active') return json(res, 401, { error: 'Tu sesión ya no es válida.' });
        if (!user.roles.includes(role)) {
          return json(res, 403, { error: `No tienes perfil de ${ROLE_LABELS[role] || role}.` });
        }
        // Pasar a médico/administrador con 2 pasos activado exige haber ingresado con 2 pasos.
        if (STAFF_ROLES.includes(role) && mfaEnabled(user.id) && !current.mfa) {
          return json(res, 200, { mfaRequired: true, mfaToken: signMfaChallenge({ id: user.id, role }) });
        }
        const token = readCookies(req)[REFRESH_COOKIE];
        if (token) {
          execute("UPDATE refresh_tokens SET revoked_at = ?, revoked_reason = 'role-switch' WHERE token_hash = ? AND revoked_at IS NULL",
            [new Date().toISOString(), sha256(token)]);
        }
        return sessionResponse(res, req, user, role, { mfa: Boolean(current.mfa) });
      },
    },
    {
      method: 'GET',
      path: '/me',
      handler: async (req, res) => {
        const current = getAuthenticatedUser(req);
        if (!current) return json(res, 401, { error: 'Sesión no válida.' });
        const user = await loadUser(current.sub);
        if (!user || !user.roles.includes(current.role)) return json(res, 401, { error: 'Sesión no válida.' });
        return json(res, 200, {
          user: { id: user.id, name: user.name, document: user.document, roles: user.roles, role: current.role, mfa: Boolean(current.mfa), mfaEnabled: mfaEnabled(user.id) },
        });
      },
    },
    {
      method: 'GET',
      path: '/mfa/status',
      handler: (req, res) => {
        const current = getAuthenticatedUser(req);
        if (!current) return json(res, 401, { error: 'Sesión no válida.' });
        return json(res, 200, { enabled: mfaEnabled(current.sub), required: mfaRequiredForStaff() && STAFF_ROLES.includes(current.role), sessionVerified: Boolean(current.mfa) });
      },
    },
    {
      // Paso 1 para activar 2 pasos: se genera un secreto y se muestra para la app autenticadora.
      method: 'POST',
      path: '/mfa/setup',
      handler: (req, res) => {
        const current = getAuthenticatedUser(req);
        if (!current) return json(res, 401, { error: 'Sesión no válida.' });
        if (mfaEnabled(current.sub)) return json(res, 409, { error: 'La verificación en dos pasos ya está activa.' });
        const secret = generateTotpSecret();
        execute(
          `INSERT INTO user_mfa (user_id, pending_secret, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET pending_secret = excluded.pending_secret, updated_at = excluded.updated_at`,
          [current.sub, seal(secret), new Date().toISOString()],
        );
        return json(res, 200, { secret, otpauthUri: otpauthUri(secret, current.document) });
      },
    },
    {
      // Paso 2: el usuario escribe el primer código de la app; si es correcto queda activo.
      method: 'POST',
      path: '/mfa/enable',
      handler: async (req, res) => {
        const current = getAuthenticatedUser(req);
        if (!current) return json(res, 401, { error: 'Sesión no válida.' });
        const { code } = parse(object({ code: CodeField }), await readJson(req));
        if (!mfaRow(current.sub)?.pendingSecret) return json(res, 400, { error: 'Primero genera la clave de configuración.' });
        if (!checkTotp(current.sub, code, 'pendingSecret')) return json(res, 400, { error: 'El código no coincide. Revisa la hora del celular e intenta de nuevo.' });
        execute('UPDATE user_mfa SET secret = pending_secret, pending_secret = NULL, enabled_at = ?, updated_at = ? WHERE user_id = ?',
          [new Date().toISOString(), new Date().toISOString(), current.sub]);
        // Las demás sesiones abiertas se cierran: deberán ingresar con 2 pasos.
        revokeUserSessions(current.sub, 'mfa-enabled');
        const user = await loadUser(current.sub);
        return sessionResponse(res, req, user, current.role, { mfa: true });
      },
    },
    {
      method: 'POST',
      path: '/mfa/disable',
      handler: async (req, res) => {
        const current = getAuthenticatedUser(req);
        if (!current) return json(res, 401, { error: 'Sesión no válida.' });
        const { code } = parse(object({ code: CodeField }), await readJson(req));
        if (!mfaEnabled(current.sub)) return json(res, 400, { error: 'La verificación en dos pasos no está activa.' });
        if (mfaRequiredForStaff() && STAFF_ROLES.some(role => current.roles?.includes(role))) {
          return json(res, 403, { error: 'Tu perfil exige verificación en dos pasos; no se puede desactivar.' });
        }
        if (!checkTotp(current.sub, code)) return json(res, 400, { error: 'El código no es correcto.' });
        execute('DELETE FROM user_mfa WHERE user_id = ?', [current.sub]);
        return json(res, 200, { enabled: false });
      },
    },
    {
      // Paso 1 de "¿Olvidaste tu contraseña?": se envía un código de 6 dígitos al correo y al celular registrados.
      method: 'POST',
      path: '/password/forgot',
      handler: async (req, res) => {
        const { document } = parse(object({ document: DocumentField }), await readJson(req));
        const problem = documentProblem(document);
        if (problem) return json(res, 400, { error: problem });
        const generic = {
          sent: true,
          message: 'Si el documento está registrado, enviamos un código de verificación a tu correo y celular.',
        };

        const recent = queryOne(
          'SELECT created_at AS createdAt FROM password_resets WHERE document = ? ORDER BY created_at DESC LIMIT 1',
          [document],
        );
        if (recent && Date.now() - new Date(recent.createdAt).getTime() < RESET_COOLDOWN_SECONDS * 1000) {
          return json(res, 429, { error: `Ya enviamos un código. Espera ${RESET_COOLDOWN_SECONDS} segundos antes de pedir otro.` });
        }

        const person = await personByDocument(document);
        if (!person || person.status !== 'active') return json(res, 200, generic);
        const channels = [];
        if (person.email) channels.push('email');
        if (person.phone) channels.push('sms');
        if (person.phone && person.whatsappOptIn) channels.push('whatsapp');
        if (!channels.length) {
          return json(res, 200, { ...generic, message: 'Tu cuenta no tiene correo ni celular registrados. Comunícate con la línea de atención para restablecer tu contraseña.' });
        }

        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const now = new Date();
        execute(
          `INSERT INTO password_resets (reset_id, user_id, document, code_hash, channels, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), person.id, document, hashPassword(code), channels.join(','),
            new Date(now.getTime() + RESET_CODE_MINUTES * 60000).toISOString(), now.toISOString()],
        );
        // El código viaja CIFRADO (AES-256-GCM) por RabbitMQ: quien lea la cola no lo ve.
        await publishEvent('password.reset_requested', { id: document, affiliateId: person.id, codeSealed: seal(code), minutes: RESET_CODE_MINUTES });

        const destinations = [person.email && maskContact(person.email), person.phone && maskContact(person.phone)].filter(Boolean);
        return json(res, 200, {
          ...generic,
          message: `Enviamos un código de 6 dígitos a ${destinations.join(' y ')}. Vence en ${RESET_CODE_MINUTES} minutos.`,
          destinations,
          // Solo en desarrollo con notificaciones simuladas se muestra el código para poder probar el flujo.
          ...(getNotificationMode() === 'mock' && !isProduction() ? { demoCode: code } : {}),
        });
      },
    },
    {
      // Paso 2: documento + código + nueva contraseña.
      method: 'POST',
      path: '/password/reset',
      handler: async (req, res) => {
        const data = parse(object({
          document: DocumentField,
          code: string({ max: 6, label: 'El código' }),
          password: string({ max: 128, label: 'La contraseña', trim: false }),
          passwordConfirm: string({ max: 128, label: 'La confirmación', trim: false }),
        }), await readJson(req));
        const { document, code } = data;
        const problem = documentProblem(document) || codeError(code) || passwordError(data.password);
        if (problem) return json(res, 400, { error: problem });
        if (data.password !== data.passwordConfirm) return json(res, 400, { error: 'Las contraseñas no coinciden.' });

        const reset = queryOne(
          `SELECT reset_id AS id, user_id AS userId, code_hash AS codeHash, expires_at AS expiresAt, attempts
           FROM password_resets WHERE document = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
          [document],
        );
        if (!reset || new Date(reset.expiresAt).getTime() < Date.now()) {
          return json(res, 400, { error: 'El código venció o no existe. Solicita uno nuevo.' });
        }
        if (reset.attempts >= MAX_RESET_ATTEMPTS) {
          return json(res, 429, { error: 'Superaste los intentos permitidos. Solicita un código nuevo.' });
        }
        if (!verifyPassword(code, reset.codeHash)) {
          execute('UPDATE password_resets SET attempts = attempts + 1 WHERE reset_id = ?', [reset.id]);
          const left = MAX_RESET_ATTEMPTS - reset.attempts - 1;
          return json(res, 400, { error: `El código no es correcto.${left > 0 ? ` Te quedan ${left} intento(s).` : ' Solicita uno nuevo.'}` });
        }
        await callService('users', '/internal/password', { method: 'POST', body: { userId: reset.userId, password: data.password } });
        execute('UPDATE password_resets SET used_at = ? WHERE reset_id = ?', [new Date().toISOString(), reset.id]);
        // Se desbloquea el ingreso para que la persona pueda entrar de inmediato.
        execute('DELETE FROM login_attempts WHERE document = ? AND success = 0', [document]);
        // Cambiar la contraseña cierra todas las sesiones abiertas (por si alguien más la conocía).
        revokeUserSessions(reset.userId, 'password-changed');
        publishEvent('password.changed', { id: document, affiliateId: reset.userId });
        return json(res, 200, { updated: true, message: 'Tu contraseña se actualizó. Ya puedes ingresar con la nueva contraseña.' });
      },
    },
    {
      // Sesiones abiertas del usuario (para que vea si hay accesos que no reconoce).
      method: 'GET',
      path: '/sessions',
      handler: (req, res) => {
        const current = getAuthenticatedUser(req);
        if (!current) return json(res, 401, { error: 'Sesión no válida.' });
        const items = queryRows(
          `SELECT created_at AS createdAt, expires_at AS expiresAt, role, user_agent AS userAgent FROM refresh_tokens
           WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC`,
          [current.sub, new Date().toISOString()],
        );
        return json(res, 200, { items });
      },
    },
  ],
});

// Limpieza periódica de tokens y códigos vencidos.
setInterval(() => {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  execute('DELETE FROM refresh_tokens WHERE expires_at < ?', [cutoff]);
  execute('DELETE FROM login_attempts WHERE attempted_at < ?', [cutoff]);
}, 3600000).unref();

