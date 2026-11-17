import './env.js'; // primero: credenciales de backend/.env
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { requireRole } from './auth.js';
import { GATEWAY_PORT, SERVICE_LABELS, SERVICES } from './config.js';
import { securityHeaders, HIDDEN_UPSTREAM_HEADERS } from './security/headers.js';
import { createRateLimiter } from './security/rate-limit.js';
import { isProduction, requireSecret } from './security/secrets.js';
import { safeEqualText } from './security/tokens.js';
import { captchaEnabled, requireCaptcha } from './security/captcha.js';

/**
 * API Gateway: única puerta de entrada desde el navegador.
 *  1. Cabeceras de seguridad y CORS por lista blanca.
 *  2. Límite de peticiones por IP (general, ingreso y consultas públicas).
 *  3. Identificador de petición (X-Request-Id) para trazar la llamada en todos los servicios.
 *  4. Bloquea /internal/* y quita cabeceras que solo usan los microservicios.
 *  5. Tolerancia a fallos: si un microservicio está apagado responde 503 SOLO para esa parte;
 *     el resto de rutas sigue funcionando. El administrador puede apagar/encender servicios
 *     (GET/POST /api/admin/services) cuando el backend corre con el supervisor (npm start).
 *  6. Con STATIC_DIR sirve también la página compilada (dist/): una sola URL para publicar el sitio.
 */

// /api/<servicio>/... → microservicio correspondiente.
const routes = Object.fromEntries(Object.values(SERVICES).map(service => [`/api/${service.name}`, service]));
const INTERNAL_KEY = requireSecret('INTERNAL_KEY');
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // detrás de Nginx: la IP real viene en X-Forwarded-For
const HTTPS = process.env.PUBLIC_HTTPS === '1' || isProduction();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
// URL pública del despliegue (Render la define sola en RENDER_EXTERNAL_URL; en otros casos PUBLIC_URL).
for (const value of [process.env.PUBLIC_URL, process.env.RENDER_EXTERNAL_URL]) {
  try { if (value) allowedOrigins.push(new URL(value).origin); } catch { console.warn(`[gateway] URL pública inválida: ${value}`); }
}

const firstHeader = value => String(value || '').split(',')[0].trim().toLowerCase();

/** La página y la API en la MISMA dirección (despliegue con STATIC_DIR o túnel): no es otro sitio. */
function isSameOrigin(origin, req) {
  try {
    const { host } = new URL(origin);
    const hosts = [firstHeader(req.headers.host), TRUST_PROXY ? firstHeader(req.headers['x-forwarded-host']) : ''].filter(Boolean);
    return hosts.includes(host.toLowerCase());
  } catch {
    return false;
  }
}

// Desarrollo: cualquier puerto de localhost o de la red local (Vite usa 5173, 5174…).
// Producción: SOLO los orígenes listados en ALLOWED_ORIGINS / PUBLIC_URL, o el mismo origen.
function isAllowedOrigin(origin, req) {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (isSameOrigin(origin, req)) return true;
  if (isProduction()) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1'
      || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname);
  } catch {
    return false;
  }
}

// ---------- Límite de peticiones ----------
const limitOf = (name, fallback) => Math.max(1, Number(process.env[name] || fallback));
const limiters = {
  general: createRateLimiter({ limit: limitOf('RATE_LIMIT_GENERAL', 300) }),        // por minuto
  auth: createRateLimiter({ limit: limitOf('RATE_LIMIT_AUTH', 20) }),               // ingreso, 2 pasos, recuperar clave
  lookup: createRateLimiter({ limit: limitOf('RATE_LIMIT_PUBLIC_LOOKUP', 30) }),    // consultas públicas con documento
};
const AUTH_PATHS = ['/api/auth/login', '/api/auth/mfa/verify', '/api/auth/password/forgot', '/api/auth/password/reset'];
const PUBLIC_LOOKUPS = [
  ['GET', '/api/users/affiliation-status'], ['GET', '/api/healthcare/authorizations'], ['GET', '/api/meds-labs/prescriptions'],
  ['GET', '/api/meds-labs/lab-results'], ['GET', '/api/pqrs/requests'], ['POST', '/api/pqrs/requests'],
  ['POST', '/api/users/register'], ['POST', '/api/users/affiliations'],
];

function clientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(item => item.trim()).filter(Boolean);
    if (forwarded.length) return forwarded.at(-1);
  }
  return req.socket.remoteAddress || 'desconocida';
}

function bucketFor(req, pathname) {
  if (req.method === 'POST' && AUTH_PATHS.includes(pathname)) return 'auth';
  if (PUBLIC_LOOKUPS.some(([method, path]) => method === req.method && path === pathname) && !req.headers.authorization) return 'lookup';
  return null;
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

/** Pregunta a cada microservicio por su /health. Devuelve [nombre, estado, base de datos]. */
function probeServices() {
  return Promise.all(Object.entries(routes).map(([base, target]) => new Promise(resolve => {
    const name = base.replace('/api/', '');
    const probe = http.get({ host: target.host, port: target.port, path: '/health', timeout: 1500 }, upstream => {
      let body = '';
      upstream.on('data', chunk => { body += chunk; });
      upstream.on('end', () => {
        let database = null;
        try { database = JSON.parse(body).database?.split(/[\\/]/).pop() || null; } catch { /* sin detalle */ }
        resolve([name, upstream.statusCode === 200 ? 'ok' : `error ${upstream.statusCode}`, database]);
      });
    });
    probe.on('timeout', () => probe.destroy());
    probe.on('error', () => resolve([name, 'apagado', null]));
  })));
}

// GET /api/health → estado de cada microservicio. El detalle de bases de datos solo se muestra
// a quien tenga la llave interna (evita revelar la estructura interna a cualquiera).
// Si alguno está apagado responde 503 con "degradado": los demás siguen atendiendo.
async function healthReport(req, res) {
  const detailed = Boolean(req.headers['x-internal-key']) && safeEqualText(req.headers['x-internal-key'], INTERNAL_KEY);
  const results = await probeServices();
  const services = Object.fromEntries(results.map(([name, status]) => [name, status]));
  const down = Object.entries(services).filter(([, value]) => value !== 'ok').map(([name]) => name);
  const body = { gateway: 'ok', status: down.length ? 'degradado' : 'ok', services, down };
  if (detailed) body.databases = Object.fromEntries(results.filter(([, , database]) => database).map(([name, , database]) => [name, database]));
  sendJson(res, down.length ? 503 : 200, body);
}

// ---------- Control de microservicios (consola del administrador) ----------
// El supervisor (start-all.js) abre un canal IPC con el gateway. Con docker compose no existe:
// allí se usa "docker compose stop <servicio>".
const SUPERVISED = typeof process.send === 'function';
const pendingReplies = new Map();
if (SUPERVISED) {
  process.on('message', message => {
    const resolve = pendingReplies.get(message?.id);
    if (resolve) { pendingReplies.delete(message.id); resolve(message); }
  });
}

function askSupervisor(message) {
  return new Promise(resolve => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pendingReplies.delete(id); resolve({ ok: false, error: 'El supervisor no respondió.' }); }, 3000);
    pendingReplies.set(id, reply => { clearTimeout(timer); resolve(reply); });
    process.send({ ...message, id });
  });
}

// Qué deja de funcionar si cada servicio se apaga (se muestra en la consola).
const IMPACT = {
  auth: 'No se puede iniciar sesión ni renovar la sesión. Quien ya ingresó sigue trabajando hasta que venza su token (15 min).',
  users: 'No hay registro, afiliación ni inicio de sesión nuevos. Citas, fórmulas y PQRS siguen funcionando con los nombres ya consultados.',
  content: 'No se cargan las noticias de la página de inicio. Todo lo demás funciona.',
  notifications: 'No se envían correos/SMS/WhatsApp ni se ve la bandeja. Las citas, PQRS y fórmulas se siguen creando.',
  healthcare: 'No se agendan citas ni autorizaciones ni se ve la historia clínica. PQRS, fórmulas y noticias siguen funcionando.',
  pqrs: 'No se radican ni consultan PQRSD. Todo lo demás funciona.',
  'meds-labs': 'No se ven fórmulas ni resultados de laboratorio. Citas, PQRS y noticias siguen funcionando.',
};

async function adminServices(req, res, pathname) {
  const user = requireRole(req, res, ['administrator']);
  if (!user) return undefined;
  const match = pathname.match(/^\/api\/admin\/services(?:\/([a-z-]+)\/(stop|start))?$/);
  if (!match) return sendJson(res, 404, { error: 'Ruta no disponible en API Gateway' });
  const [, name, action] = match;
  if (action) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Usa POST.' });
    if (!Object.hasOwn(SERVICES, name)) return sendJson(res, 404, { error: 'Microservicio desconocido.' });
    if (!SUPERVISED) {
      return sendJson(res, 409, { error: `El backend corre con Docker: usa "docker compose ${action} ${name}" en la terminal.` });
    }
    const reply = await askSupervisor({ type: action === 'stop' ? 'service:stop' : 'service:start', name, by: user.name || user.document });
    if (!reply.ok) return sendJson(res, 400, { error: reply.error || 'No se pudo cambiar el servicio.' });
    console.log(`[gateway] ${user.name || user.sub} ${action === 'stop' ? 'apagó' : 'encendió'} ${name} (${req.headers['x-request-id'] || ''})`);
    await new Promise(resolve => setTimeout(resolve, action === 'start' ? 900 : 300)); // deja arrancar/cerrar
  } else if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Usa GET.' });
  }
  const [probe, supervisor] = await Promise.all([
    probeServices(),
    SUPERVISED ? askSupervisor({ type: 'services:list' }) : Promise.resolve(null),
  ]);
  const processes = Object.fromEntries((supervisor?.items || []).map(item => [item.name, item]));
  const items = probe.map(([serviceName, status]) => ({
    name: serviceName,
    label: SERVICE_LABELS[serviceName] || serviceName,
    port: SERVICES[serviceName].port,
    status,
    impact: IMPACT[serviceName] || '',
    stoppedBy: processes[serviceName]?.stoppedBy || null,
    recoverAt: processes[serviceName]?.recoverAt || null,
  }));
  return sendJson(res, 200, {
    control: SUPERVISED ? 'supervisor' : 'docker',
    autoRecoverMinutes: supervisor?.autoRecoverMinutes ?? null,
    items,
  });
}

// ---------- Página web compilada (opcional, STATIC_DIR) ----------
const STATIC_DIR = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
// Misma política que nginx/default.conf.
const WEB_CSP = "default-src 'self'; script-src 'self' https://js.hcaptcha.com https://*.hcaptcha.com; "
  + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.hcaptcha.com; font-src 'self' https://fonts.gstatic.com; "
  + "img-src 'self' data:; connect-src 'self' https://*.hcaptcha.com; frame-src https://*.hcaptcha.com; object-src 'none'; "
  + "base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

function serveStatic(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) return sendJson(res, 405, { error: 'Método no permitido.' });
  let relative;
  try { relative = decodeURIComponent(pathname); } catch { return sendJson(res, 400, { error: 'Ruta inválida.' }); }
  // Nunca archivos ocultos (.env, .git), mapas de código ni rutas fuera de la carpeta.
  if (relative.includes('\0') || /(^|\/)\./.test(relative) || relative.endsWith('.map')) return sendJson(res, 404, { error: 'No encontrado.' });
  let file = path.resolve(STATIC_DIR, `.${path.posix.normalize(relative)}`);
  if (file !== STATIC_DIR && !file.startsWith(`${STATIC_DIR}${path.sep}`)) return sendJson(res, 404, { error: 'No encontrado.' });
  let stat = fs.statSync(file, { throwIfNoEntry: false });
  if (!stat || !stat.isFile()) {
    if (path.extname(relative)) return sendJson(res, 404, { error: 'No encontrado.' });
    file = path.join(STATIC_DIR, 'index.html'); // rutas de React Router (SPA)
    stat = fs.statSync(file);
  }
  const viaHttps = TRUST_PROXY && firstHeader(req.headers['x-forwarded-proto']) === 'https';
  res.setHeader('Content-Security-Policy', viaHttps ? `${WEB_CSP}; upgrade-insecure-requests` : WEB_CSP);
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('Pragma');
  res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

// Cabeceras que el navegador nunca puede enviar a los microservicios (las ponen los propios servicios o el gateway).
const STRIPPED_REQUEST_HEADERS = ['x-internal-key', 'x-service-token', 'x-client-ip', 'x-request-id', 'x-forwarded-for', 'x-forwarded-host'];

async function handle(req, res) {
  const requestId = crypto.randomUUID();
  const origin = req.headers.origin;
  const allowed = isAllowedOrigin(origin, req);
  const ip = clientIp(req);
  securityHeaders(res, { https: HTTPS });
  res.setHeader('X-Request-Id', requestId);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true'); // cookie HttpOnly del refresh token
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Captcha-Token');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') {
    res.writeHead(allowed ? 204 : 403);
    return res.end();
  }
  // Un navegador de otro origen no autorizado no puede usar la API con las cookies del usuario.
  if (origin && !allowed && req.method !== 'GET') {
    return sendJson(res, 403, { error: 'Origen no autorizado.' });
  }

  const pathname = String(req.url || '/').split('?')[0];
  // La página compilada no pasa por el límite de peticiones de la API (una carga trae muchos archivos).
  if (STATIC_DIR && pathname !== '/api' && !pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
  if (pathname === '/api/ping') return sendJson(res, 200, { ok: true }); // para el health check de la nube
  if (pathname === '/api/health') return healthReport(req, res);

  // Límite general por IP y, además, uno más estricto para ingreso y consultas públicas.
  const special = bucketFor(req, pathname);
  for (const bucket of ['general', special].filter(Boolean)) {
    const result = limiters[bucket](`${bucket}:${ip}`);
    if (!result.allowed) {
      console.warn(`[gateway] límite "${bucket}" superado por ${ip} en ${req.method} ${pathname} (${requestId})`);
      return sendJson(res, 429, { error: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.' },
        { 'Retry-After': String(result.retryAfter) });
    }
  }

  // Consultas públicas sin sesión (documento + número, radicar PQRSD, registro): CAPTCHA si está configurado.
  if (special === 'lookup' && captchaEnabled()) {
    try {
      await requireCaptcha({ headers: { ...req.headers, 'x-client-ip': ip } });
    } catch (error) {
      return sendJson(res, error.status || 400, { error: error.message });
    }
  }

  if (pathname === '/api/admin/services' || pathname.startsWith('/api/admin/services/')) return adminServices(req, res, pathname);

  const entry = Object.entries(routes).find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!entry) return sendJson(res, 404, { error: 'Ruta no disponible en API Gateway' });

  const [base, target] = entry;
  const upstreamPath = req.url.slice(base.length) || '/';
  // Las rutas /internal/* son solo para la comunicación entre microservicios.
  if (/^\/+internal(\/|$|\?)/i.test(upstreamPath) || /%2f|%5c|\\|\/\.\.?(\/|$)/i.test(upstreamPath)) {
    return sendJson(res, 404, { error: 'Ruta no disponible en API Gateway' });
  }
  const headers = { ...req.headers };
  STRIPPED_REQUEST_HEADERS.forEach(name => delete headers[name]);
  headers['x-request-id'] = requestId;
  headers['x-client-ip'] = ip;

  const proxy = http.request({ host: target.host, port: target.port, path: upstreamPath, method: req.method, headers, timeout: 15000 }, upstream => {
    const responseHeaders = { ...upstream.headers };
    HIDDEN_UPSTREAM_HEADERS.forEach(name => delete responseHeaders[name]);
    res.writeHead(upstream.statusCode, responseHeaders);
    upstream.pipe(res);
  });
  proxy.on('timeout', () => proxy.destroy(new Error('timeout')));
  proxy.on('error', () => {
    // Solo falla ESTA parte del sitio: los demás microservicios siguen respondiendo.
    const name = base.replace('/api/', '');
    if (!res.headersSent) {
      sendJson(res, 503, {
        error: `El servicio de ${SERVICE_LABELS[name] || name} no está disponible en este momento. El resto del portal sigue funcionando.`,
        service: name,
        unavailable: true,
      }, { 'Retry-After': '30' });
    } else res.end();
  });
  req.pipe(proxy);
}

const gateway = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error('[gateway] error inesperado', error);
    if (!res.headersSent) sendJson(res, 500, { error: 'Error interno del gateway.' });
  });
});

gateway.headersTimeout = 20000;  // protege contra conexiones lentas (Slowloris)
gateway.requestTimeout = 30000;
gateway.listen(GATEWAY_PORT, () => console.log(`api-gateway escuchando en http://localhost:${GATEWAY_PORT}`));
process.once('SIGTERM', () => gateway.close(() => process.exit(0)));
process.once('SIGINT', () => gateway.close(() => process.exit(0)));
