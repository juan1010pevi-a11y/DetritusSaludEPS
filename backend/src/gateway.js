import http from 'node:http';
import { GATEWAY_PORT, SERVICES } from './config.js';

// /api/<servicio>/... → microservicio correspondiente.
const routes = Object.fromEntries(Object.values(SERVICES).map(service => [`/api/${service.name}`, service]));

// Desarrollo local: se acepta cualquier puerto de localhost o de la red local (Vite puede usar 5173, 5174, 5175…).
function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1'
      || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname)
      || (process.env.ALLOWED_ORIGINS || '').split(',').includes(origin);
  } catch {
    return false;
  }
}

// GET /api/health → estado de cada microservicio y de su base de datos, útil para diagnosticar.
function healthReport(res) {
  const checks = Object.entries(routes).map(([base, target]) => new Promise(resolve => {
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
  }));
  Promise.all(checks).then(results => {
    const services = Object.fromEntries(results.map(([name, status]) => [name, status]));
    const databases = Object.fromEntries(results.filter(([, , database]) => database).map(([name, , database]) => [name, database]));
    const allOk = Object.values(services).every(value => value === 'ok');
    res.writeHead(allOk ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ gateway: 'ok', services, databases }, null, 2));
  });
}

const gateway = http.createServer((req, res) => {
  const origin = req.headers.origin;
  const allowed = isAllowedOrigin(origin);
  if (allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/api/health') return healthReport(res);

  const entry = Object.entries(routes).find(([prefix]) => req.url === prefix || req.url.startsWith(`${prefix}/`) || req.url.startsWith(`${prefix}?`));
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Ruta no disponible en API Gateway' }));
  }

  const [base, target] = entry;
  const upstreamPath = req.url.slice(base.length) || '/';
  // Las rutas /internal/* son solo para la comunicación entre microservicios.
  if (upstreamPath.startsWith('/internal')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Ruta no disponible en API Gateway' }));
  }
  const { 'x-internal-key': _ignored, ...headers } = req.headers;
  const proxy = http.request({ host: target.host, port: target.port, path: upstreamPath, method: req.method, headers }, upstream => {
    res.writeHead(upstream.statusCode, {
      ...upstream.headers,
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    });
    upstream.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Servicio no disponible' }));
  });
  req.pipe(proxy);
});

gateway.listen(GATEWAY_PORT, () => console.log(`api-gateway escuchando en http://localhost:${GATEWAY_PORT}`));
process.once('SIGTERM', () => gateway.close(() => process.exit(0)));
process.once('SIGINT', () => gateway.close(() => process.exit(0)));
