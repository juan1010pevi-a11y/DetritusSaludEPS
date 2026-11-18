import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { startBackend } from './helpers.js';
import { hashPassword, needsRehash, verifyPassword } from '../src/security/passwords.js';
import { signJwt, verifyJwt } from '../src/security/tokens.js';
import { base32Encode, hotp, totp, verifyTotp } from '../src/security/totp.js';
import { createRateLimiter } from '../src/security/rate-limit.js';

const require = createRequire(import.meta.url);
const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

// ---------------------------------------------------------------------------
// Pruebas unitarias de los módulos de seguridad
// ---------------------------------------------------------------------------
describe('Módulos de seguridad (unitarias)', () => {
  test('scrypt: verifica la contraseña correcta y rechaza la incorrecta y el texto plano', () => {
    process.env.PASSWORD_HASH_COST = '12';
    const stored = hashPassword('clave2026');
    assert.match(stored, /^scrypt\$12\$8\$1\$/);
    assert.equal(verifyPassword('clave2026', stored), true);
    assert.equal(verifyPassword('otra2026', stored), false);
    assert.equal(verifyPassword('clave2026', 'clave2026'), false, 'una contraseña en texto plano nunca se acepta');
  });

  test('acepta hashes PBKDF2 antiguos y pide actualizarlos', () => {
    const salt = crypto.randomBytes(16);
    const legacy = `${salt.toString('hex')}:${crypto.pbkdf2Sync('demo123', salt, 100000, 32, 'sha256').toString('hex')}`;
    assert.equal(verifyPassword('demo123', legacy), true);
    assert.equal(needsRehash(legacy), true);
  });

  test('JWT: rechaza firma alterada, alg none, otra audiencia y token vencido', () => {
    const secret = 'x'.repeat(48);
    const options = { secret, issuer: 'iss', audience: 'aud', expiresInSeconds: 60 };
    const token = signJwt({ sub: 'u1', role: 'affiliate' }, options);
    assert.equal(verifyJwt(token, options).sub, 'u1');

    const [header, payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), role: 'administrator' })).toString('base64url');
    assert.equal(verifyJwt(`${header}.${forged}.${signature}`, options), null, 'cambiar el rol invalida la firma');

    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    assert.equal(verifyJwt(`${none}.${payload}.`, options), null, 'alg none no se acepta');
    assert.equal(verifyJwt(token, { ...options, audience: 'otro' }), null);
    assert.equal(verifyJwt(signJwt({ sub: 'u1' }, { ...options, expiresInSeconds: -120 }), options), null);
  });

  test('TOTP cumple el vector de prueba del RFC 6238 y no acepta códigos reutilizados', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    assert.equal(totp(secret, 59000), '287082');     // RFC 6238, T = 59 s (últimos 6 dígitos de 94287082)
    assert.equal(hotp(secret, 1), '287082');
    const step = verifyTotp(secret, '287082', { now: 59000 });
    assert.equal(step, 1);
    assert.equal(verifyTotp(secret, '287082', { now: 59000, lastStep: step }), null, 'un código usado no sirve otra vez');
  });

  test('el limitador de peticiones corta al superar el límite', () => {
    const hit = createRateLimiter({ limit: 3, windowMs: 60000 });
    assert.deepEqual([1, 2, 3, 4].map(() => hit('ip').allowed), [true, true, true, false]);
    assert.ok(hit('ip').retryAfter > 0);
    assert.equal(hit('otra-ip').allowed, true);
  });
});

// ---------------------------------------------------------------------------
// Pruebas de integración: todo el backend levantado
// ---------------------------------------------------------------------------
let backend;
let api;
const tokens = {};

/** Login que devuelve también la cookie del refresh token. */
async function loginWithCookie(document, password, role) {
  const response = await fetch(`http://localhost:5700/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document, password, role }),
  });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
}

async function refresh(cookie) {
  const response = await fetch('http://localhost:5700/api/auth/refresh', { method: 'POST', headers: { cookie: cookie.split(';')[0] } });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
}

before(async () => {
  backend = await startBackend({ basePort: 5700, env: { REFRESH_REUSE_GRACE_SECONDS: '0' } });
  api = backend.api;
  tokens.affiliate = await backend.login('123456789', 'demo123', 'affiliate');
  tokens.laura = await backend.login('1010101010', 'demo123', 'affiliate');
  tokens.admin = await backend.login('900000002', 'admin123', 'administrator');
  tokens.doctor = await backend.login('900000001', 'doctor123', 'doctor');
  tokens.pediatrics = await backend.login('900000003', 'medico123', 'doctor');
});

after(async () => {
  await backend?.stop();
});

describe('Control de acceso', () => {
  test('el perfil completo ya no es público', async () => {
    const anonymous = await api('/users/profile?document=123456789');
    assert.equal(anonymous.status, 401);
  });

  test('un afiliado no puede ver el perfil de otro (403) pero sí el suyo', async () => {
    const other = await api('/users/profile?document=123456789', { token: tokens.laura });
    assert.equal(other.status, 403);
    const own = await api('/users/profile', { token: tokens.affiliate });
    assert.equal(own.status, 200);
    assert.equal(own.data.document, '123456789');
    const admin = await api('/users/profile?document=123456789', { token: tokens.admin });
    assert.equal(admin.status, 200);
  });

  test('la consulta pública de afiliación no revela nombre ni beneficiarios', async () => {
    const response = await api('/users/affiliation-status?document=123456789');
    assert.equal(response.status, 200);
    assert.equal(response.data.found, true);
    assert.equal(response.data.status, 'active');
    assert.equal(response.data.name, undefined);
    assert.equal(response.data.beneficiaries, undefined);
  });

  test('un token alterado o inventado recibe 401', async () => {
    const [header, payload, signature] = tokens.affiliate.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...claims, role: 'administrator' })).toString('base64url');
    const response = await api('/healthcare/authorizations/queue', { token: `${header}.${forged}.${signature}` });
    assert.equal(response.status, 401);
    const invented = await api('/healthcare/appointments/mine', { token: 'abc.def.ghi' });
    assert.equal(invented.status, 401);
  });

  test('un médico no ve la historia clínica de un paciente que no atiende', async () => {
    const response = await api('/healthcare/clinical-history?patientId=user-001', { token: tokens.pediatrics });
    assert.equal(response.status, 403);
  });

  test('sin perfil administrador no se listan fórmulas ni resultados ajenos', async () => {
    const formulas = await api('/meds-labs/prescriptions', { token: tokens.doctor });
    assert.equal(formulas.status, 400);
    const labs = await api('/meds-labs/lab-results', { token: tokens.doctor });
    assert.equal(labs.status, 400);
  });

  test('las rutas internas no se pueden usar sin token de servicio', async () => {
    const viaGateway = await api('/users/internal/people?role=doctor');
    assert.equal(viaGateway.status, 404);
    const encoded = await api('/users/%2finternal/people?role=doctor');
    assert.equal(encoded.status, 404);
    // Llamada directa al puerto del microservicio (users = BASE_PORT + 2) con la llave vieja: rechazada.
    const direct = await fetch('http://localhost:5702/internal/people?role=doctor', { headers: { 'x-internal-key': 'detritus-internal-key' } });
    assert.equal(direct.status, 403);
  });
});

describe('Sesiones y autenticación', () => {
  test('el login entrega un JWT de 15 minutos y una cookie HttpOnly SameSite=Strict', async () => {
    const { status, data, cookie } = await loginWithCookie('123456789', 'demo123', 'affiliate');
    assert.equal(status, 200);
    const claims = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64url').toString());
    assert.equal(claims.exp - claims.iat, 15 * 60);
    assert.equal(claims.aud, 'detritus-api');
    assert.match(cookie, /detritus_rt=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Path=\/api\/auth/);
  });

  test('el refresh rota la cookie, el cierre de sesión la revoca y reusar una vieja cierra la familia', async () => {
    const login = await loginWithCookie('123456789', 'demo123', 'affiliate');
    const first = await refresh(login.cookie);
    assert.equal(first.status, 200);
    assert.ok(first.data.token);
    assert.notEqual(first.cookie.split(';')[0], login.cookie.split(';')[0]);

    // Reusar la cookie ya rotada = posible robo: se revocan todas las sesiones de esa familia.
    const reuse = await refresh(login.cookie);
    assert.equal(reuse.status, 401);
    const afterTheft = await refresh(first.cookie);
    assert.equal(afterTheft.status, 401, 'la cookie nueva también quedó revocada');

    const second = await loginWithCookie('123456789', 'demo123', 'affiliate');
    const logout = await fetch('http://localhost:5700/api/auth/logout', { method: 'POST', headers: { cookie: second.cookie.split(';')[0] } });
    assert.equal(logout.status, 200);
    assert.equal((await refresh(second.cookie)).status, 401);
  });

  test('las contraseñas se guardan con scrypt', async () => {
    const SQL = await initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
    const database = new SQL.Database(fs.readFileSync(path.join(backend.dataDir, 'users.sqlite')));
    const passwords = database.exec('SELECT password FROM dim_affiliates')[0].values.flat();
    database.close();
    assert.ok(passwords.every(value => value.startsWith('scrypt$')));
  });

  test('verificación en dos pasos: activar, exigir el código y rechazar uno incorrecto', async () => {
    const setup = await api('/auth/mfa/setup', { method: 'POST', token: tokens.admin });
    assert.equal(setup.status, 200);
    assert.match(setup.data.otpauthUri, /^otpauth:\/\/totp\//);
    const enable = await api('/auth/mfa/enable', { method: 'POST', token: tokens.admin, body: { code: totp(setup.data.secret) } });
    assert.equal(enable.status, 200);
    assert.equal(enable.data.user.mfa, true);

    const login = await api('/auth/login', { method: 'POST', body: { document: '900000002', password: 'admin123', role: 'administrator' } });
    assert.equal(login.status, 200);
    assert.equal(login.data.mfaRequired, true);
    assert.equal(login.data.token, undefined, 'sin el código no hay sesión');

    const wrong = await api('/auth/mfa/verify', { method: 'POST', body: { mfaToken: login.data.mfaToken, code: '000000' } });
    assert.equal(wrong.status, 401);
    // El código del paso siguiente (±30 s) también es válido y no se ha usado.
    const next = hotp(setup.data.secret, Math.floor(Date.now() / 30000) + 1);
    const ok = await api('/auth/mfa/verify', { method: 'POST', body: { mfaToken: login.data.mfaToken, code: next } });
    assert.equal(ok.status, 200);
    assert.ok(ok.data.token);
    tokens.admin = ok.data.token;
  });
});

describe('Protección de datos', () => {
  test('la historia clínica está cifrada en la base pero se lee en claro por la API', async () => {
    const SQL = await initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
    const database = new SQL.Database(fs.readFileSync(path.join(backend.dataDir, 'healthcare.sqlite')));
    const [diagnosis, allergies] = database.exec(
      "SELECT e.diagnosis, b.allergies FROM clinical_encounters e JOIN clinical_backgrounds b ON b.patient_id = e.patient_id WHERE e.encounter_id = 'HC-DEMO-0001'",
    )[0].values[0];
    database.close();
    assert.match(diagnosis, /^enc:v1:/);
    assert.match(allergies, /^enc:v1:/);
    assert.ok(!diagnosis.includes('Hipertensión'));

    const history = await api('/healthcare/clinical-history/mine', { token: tokens.affiliate });
    assert.equal(history.status, 200);
    assert.equal(history.data.encounters[0].diagnosis, 'Hipertensión esencial');
    assert.equal(history.data.background.allergies, 'Penicilina');
  });

  test('cada consulta de la historia clínica queda en la auditoría', async () => {
    const read = await api('/healthcare/clinical-history?patientId=user-001', { token: tokens.doctor });
    assert.equal(read.status, 200);
    const log = await api('/healthcare/audit?patientId=user-001', { token: tokens.admin });
    assert.equal(log.status, 200);
    assert.ok(log.data.items.some(item => item.action === 'clinical_history.read' && item.actorId === 'staff-doctor'));
    assert.ok(log.data.items.some(item => item.action === 'clinical_history.read' && item.outcome === 'denied'));
    const forbidden = await api('/healthcare/audit', { token: tokens.doctor });
    assert.equal(forbidden.status, 403);
  });

  test('el registro exige la autorización de tratamiento de datos', async () => {
    const body = { name: 'Persona Prueba', document: '1098700001', email: 'p@example.com', phone: '3105550001', password: 'clave2026' };
    const without = await api('/users/register', { method: 'POST', body });
    assert.equal(without.status, 400);
    assert.match(without.data.error, /tratamiento de tus datos/);
    const withConsent = await api('/users/register', { method: 'POST', body: { ...body, acceptDataPolicy: true } });
    assert.equal(withConsent.status, 201);
  });
});

describe('API Gateway', () => {
  test('las respuestas traen las cabeceras de seguridad y un X-Request-Id', async () => {
    const response = await api('/content/news');
    for (const header of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'x-request-id']) {
      assert.ok(response.headers.get(header), `falta ${header}`);
    }
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
  });

  test('CORS: un origen desconocido no recibe permiso', async () => {
    const preflight = await fetch('http://localhost:5700/api/auth/login', { method: 'OPTIONS', headers: { Origin: 'https://atacante.example' } });
    assert.equal(preflight.status, 403);
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);
    const post = await api('/auth/login', { method: 'POST', headers: { Origin: 'https://atacante.example' }, body: { document: '123456789', password: 'demo123' } });
    assert.equal(post.status, 403);
  });

  test('rechaza cuerpos que no son JSON y claves de prototype pollution', async () => {
    const text = await fetch('http://localhost:5700/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hola' });
    assert.equal(text.status, 415);
    const polluted = await fetch('http://localhost:5700/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"__proto__":{"admin":true},"document":"123456789","password":"x"}',
    });
    assert.equal(polluted.status, 401);
    assert.equal({}.admin, undefined);
  });
});

describe('Límite de peticiones y configuración segura', () => {
  test('el gateway responde 429 con Retry-After al superar el límite de ingreso', async () => {
    const limited = await startBackend({ basePort: 5800, env: { RATE_LIMIT_AUTH: '3' } });
    try {
      const statuses = [];
      let last;
      for (let i = 0; i < 4; i += 1) {
        last = await limited.api('/auth/login', { method: 'POST', body: { document: '123456789', password: 'mala1234' } });
        statuses.push(last.status);
      }
      assert.deepEqual(statuses, [401, 401, 401, 429]);
      assert.ok(Number(last.headers.get('retry-after')) > 0);
    } finally {
      await limited.stop();
    }
  });

  test('en producción un microservicio no arranca sin secretos fuertes', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detritus-prod-'));
    const child = spawn(process.execPath, [path.join(srcDir, 'auth-service.js')], {
      env: { ...process.env, NODE_ENV: 'production', DETRITUS_SKIP_ENV_FILE: '1', DATA_DIR: dataDir, AUTH_SECRET: 'change-this-in-production', INTERNAL_KEY: '', DATA_KEY: '', BASE_PORT: '5900' },
    });
    let output = '';
    child.stderr.on('data', chunk => { output += chunk; });
    const code = await new Promise(resolve => child.once('exit', resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
    assert.notEqual(code, 0);
    assert.match(output, /Configuración insegura/);
  });
});
