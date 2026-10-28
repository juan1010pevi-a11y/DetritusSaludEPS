import http from 'node:http';
import { SERVICES } from './config.js';

export class HttpError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function json(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 1024 * 1024;

export async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'La solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'El cuerpo de la solicitud no es un JSON válido.');
  }
}

/**
 * Crea el servidor HTTP del microservicio. `serviceKey` es el nombre en config.js
 * (auth, users, healthcare…), del que sale el puerto.
 */
export function startService({ name, serviceKey, routes }) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const route = routes.find(item => item.method === req.method && item.path === url.pathname);
      if (!route) return json(res, 404, { service: name, error: 'Ruta no encontrada' });
      return await route.handler(req, res, url);
    } catch (error) {
      if (error instanceof HttpError) return json(res, error.status, { ...error.data, error: error.message });
      console.error(`[${name}]`, error);
      return json(res, 500, { service: name, error: 'Error interno del servicio.' });
    }
  });
  const { port } = SERVICES[serviceKey];
  server.listen(port, () => console.log(`${name} escuchando en http://localhost:${port}`));
  const stop = () => server.close(() => process.exit(0));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return server;
}
