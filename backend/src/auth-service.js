import crypto from 'node:crypto';
import { startService, json, readJson } from './service.js';
import { createDatabase } from './database.js';
import { getAuthenticatedUser, ROLE_LABELS, signToken } from './auth.js';
import { callService, personByDocument } from './internal.js';
import { publishEvent } from './broker.js';
import { hashPassword, verifyPassword } from './security.js';
import { getNotificationMode } from './notification-providers.js';
import { codeError, documentError, maskContact, passwordError } from './validators.js';

const db = await createDatabase('auth');
const { queryOne, execute } = db;

const MAX_FAILED_LOGINS = 5;           // intentos fallidos permitidos…
const LOCK_MINUTES = 15;               // …en esta ventana de tiempo
const RESET_CODE_MINUTES = 15;         // vigencia del código de recuperación
const MAX_RESET_ATTEMPTS = 5;
const RESET_COOLDOWN_SECONDS = 60;     // evita enviar códigos en ráfaga

const minutesAgo = minutes => new Date(Date.now() - minutes * 60000).toISOString();

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

async function sessionResponse(user, role) {
  const publicUser = {
    id: user.id,
    name: user.name,
    document: user.document,
    role,
    roles: user.roles,
    doctor: user.roles.includes('doctor') ? await doctorProfile(user.id) : null,
  };
  return { token: signToken(publicUser), user: publicUser };
}

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
        const { document, password, role } = await readJson(req);
        const value = String(document || '').trim();
        const problem = documentError(value, /[A-Za-z]/.test(value) ? 'PA' : 'CC');
        if (problem) return json(res, 400, { error: problem });
        if (!password) return json(res, 400, { error: 'Escribe tu contraseña.' });

        // Bloqueo temporal por fuerza bruta: 5 intentos fallidos en 15 minutos.
        const failed = queryOne(
          'SELECT COUNT(*) AS total FROM login_attempts WHERE document = ? AND success = 0 AND attempted_at > ?',
          [value, minutesAgo(LOCK_MINUTES)],
        ).total;
        if (failed >= MAX_FAILED_LOGINS) {
          return json(res, 429, { error: `Demasiados intentos fallidos. Espera ${LOCK_MINUTES} minutos o usa “¿Olvidaste tu contraseña?”.` });
        }

        let user = null;
        try {
          user = (await callService('users', '/internal/credentials/verify', { method: 'POST', body: { document: value, password } })).user;
        } catch (error) {
          if (error.status !== 401) throw error;
        }
        execute('INSERT INTO login_attempts (document, success, attempted_at) VALUES (?, ?, ?)', [value, user ? 1 : 0, new Date().toISOString()]);
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
        return json(res, 200, await sessionResponse(user, role || user.roles[0]));
      },
    },
    {
      // Una persona con varios perfiles (p. ej. afiliada y médica) cambia de perfil sin volver a escribir su contraseña.
      method: 'POST',
      path: '/switch-role',
      handler: async (req, res) => {
        const current = getAuthenticatedUser(req);
        if (!current) return json(res, 401, { error: 'Tu sesión expiró. Ingresa de nuevo.' });
        const { role } = await readJson(req);
        const user = await loadUser(current.sub);
        if (!user || user.status !== 'active') return json(res, 401, { error: 'Tu sesión ya no es válida.' });
        if (!user.roles.includes(role)) {
          return json(res, 403, { error: `No tienes perfil de ${ROLE_LABELS[role] || role}.` });
        }
        return json(res, 200, await sessionResponse(user, role));
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
        return json(res, 200, { user: { id: user.id, name: user.name, document: user.document, roles: user.roles, role: current.role } });
      },
    },
    {
      // Paso 1 de "¿Olvidaste tu contraseña?": se envía un código de 6 dígitos al correo y al celular registrados.
      method: 'POST',
      path: '/password/forgot',
      handler: async (req, res) => {
        const data = await readJson(req);
        const document = String(data.document || '').trim();
        const problem = documentError(document, /[A-Za-z]/.test(document) ? 'PA' : 'CC');
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
        await publishEvent('password.reset_requested', { id: document, affiliateId: person.id, code, minutes: RESET_CODE_MINUTES });

        const destinations = [person.email && maskContact(person.email), person.phone && maskContact(person.phone)].filter(Boolean);
        return json(res, 200, {
          ...generic,
          message: `Enviamos un código de 6 dígitos a ${destinations.join(' y ')}. Vence en ${RESET_CODE_MINUTES} minutos.`,
          destinations,
          // En modo demostración no se envían correos reales: se muestra el código para poder probar el flujo.
          ...(getNotificationMode() === 'mock' ? { demoCode: code } : {}),
        });
      },
    },
    {
      // Paso 2: documento + código + nueva contraseña.
      method: 'POST',
      path: '/password/reset',
      handler: async (req, res) => {
        const data = await readJson(req);
        const document = String(data.document || '').trim();
        const code = String(data.code || '').trim();
        const problem = documentError(document, /[A-Za-z]/.test(document) ? 'PA' : 'CC') || codeError(code) || passwordError(data.password);
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
        publishEvent('password.changed', { id: document, affiliateId: reset.userId });
        return json(res, 200, { updated: true, message: 'Tu contraseña se actualizó. Ya puedes ingresar con la nueva contraseña.' });
      },
    },
  ],
});
