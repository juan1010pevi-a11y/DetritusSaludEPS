import http from 'node:http';

const routes = {
  '/api/auth': { host: process.env.AUTH_HOST || 'localhost', port: 4001, prefix: '' },
  '/api/users': { host: process.env.USERS_HOST || 'localhost', port: 4002, prefix: '' },
  '/api/content': { host: process.env.CONTENT_HOST || 'localhost', port: 4003, prefix: '' },
  '/api/notifications': { host: process.env.NOTIFICATIONS_HOST || 'localhost', port: 4004, prefix: '' },
  '/api/healthcare': { host: process.env.HEALTHCARE_HOST || 'localhost', port: 4005, prefix: '' },
  '/api/pqrs': { host: process.env.PQRS_HOST || 'localhost', port: 4006, prefix: '' },
  '/api/meds-labs': { host: process.env.MEDS_LABS_HOST || 'localhost', port: 4007, prefix: '' },
};

const gateway = http.createServer((req, res) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const entry = Object.entries(routes).find(([prefix]) => req.url.startsWith(prefix));
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Ruta no disponible en API Gateway' }));
  }

  const [base, target] = entry;
  const upstreamPath = req.url.replace(base, target.prefix) || '/';
  const proxy = http.request({ ...target, path: upstreamPath, method: req.method, headers: req.headers }, upstream => {
    res.writeHead(upstream.statusCode, {
      ...upstream.headers,
      ...(allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    });
    upstream.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Servicio no disponible' }));
  });
  req.pipe(proxy);
});

gateway.listen(4000, () => console.log('api-gateway escuchando en http://localhost:4000'));
