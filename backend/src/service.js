import http from 'node:http';
import { SERVICES } from './config.js';

export class HttpError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function json(res, status, body, headers = {}) {
  if (res.headersSent) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

/** Lee las cookies de la petición como objeto { nombre: valor }. */
export function readCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    try { cookies[name] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* cookie mal formada */ }
  }
  return cookies;
}

// Nombre del microservicio que corre en este proceso (lo usa la autenticación entre servicios).
let currentService = null;
export const getCurrentService = () => currentService;

// Claves que permitirían "prototype pollution" al mezclar objetos: se descartan al leer JSON.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;

function depthOf(value, depth = 0) {
  if (depth > MAX_DEPTH) return depth;
  if (!value || typeof value !== 'object') return depth;
  let max = depth;
  for (const item of Object.values(value)) max = Math.max(max, depthOf(item, depth + 1));
  return max;
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
  const type = String(req.headers['content-type'] || '');
  if (type && !type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'La solicitud debe enviarse como JSON (Content-Type: application/json).');
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'), (key, value) => (FORBIDDEN_KEYS.has(key) ? undefined : value));
  } catch {
    throw new HttpError(400, 'El cuerpo de la solicitud no es un JSON válido.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'El cuerpo de la solicitud debe ser un objeto JSON.');
  }
  if (depthOf(data) > MAX_DEPTH) throw new HttpError(400, 'El cuerpo de la solicitud tiene demasiados niveles.');
  return data;
}

/**
 * Crea el servidor HTTP del microservicio. `serviceKey` es el nombre en config.js
 * (auth, users, healthcare…), del que sale el puerto.
 */
export function startService({ name, serviceKey, routes }) {
  currentService = serviceKey;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const route = routes.find(item => item.method === req.method && item.path === url.pathname);
      if (!route) return json(res, 404, { service: name, error: 'Ruta no encontrada' });
      return await route.handler(req, res, url);
    } catch (error) {
      if (error instanceof HttpError) return json(res, error.status, { ...error.data, error: error.message });
      // Al cliente nunca se le muestra el detalle técnico del error (puede revelar estructura interna).
      console.error(`[${name}] ${req.method} ${req.url?.split('?')[0]} (${req.headers['x-request-id'] || 'sin id'})`, error);
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
