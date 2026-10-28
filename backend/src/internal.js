import { serviceUrl } from './config.js';
import { HttpError, json } from './service.js';

/**
 * Comunicación síncrona entre microservicios. Como cada servicio tiene su propia
 * base de datos, cuando uno necesita información de otro (por ejemplo, el nombre
 * de un paciente que vive en users-service) la pide por HTTP a una ruta /internal/*.
 * El API Gateway nunca expone esas rutas al navegador y además exigen esta llave.
 */
const INTERNAL_KEY = process.env.INTERNAL_KEY || 'detritus-internal-key';
const LABELS = {
  auth: 'autenticación', users: 'usuarios', content: 'contenidos', notifications: 'notificaciones',
  healthcare: 'citas y autorizaciones', pqrs: 'PQRS', 'meds-labs': 'medicamentos y laboratorio',
};

export async function callService(service, path, { method = 'GET', body, timeout = 5000 } = {}) {
  let response;
  try {
    response = await fetch(`${serviceUrl(service)}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new HttpError(503, `El microservicio de ${LABELS[service] || service} no está disponible. Reinicia el backend con npm start.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status, data.error || `El microservicio ${service} respondió ${response.status}.`, data);
  return data;
}

/** Igual que callService, pero devuelve `fallback` si el otro servicio falla. */
export async function tryCallService(service, path, options = {}, fallback = null) {
  try {
    return await callService(service, path, options);
  } catch (error) {
    console.warn(`Llamada interna a ${service}${path} falló: ${error.message}`);
    return fallback;
  }
}

export function requireInternal(req, res) {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY) {
    json(res, 403, { error: 'Ruta interna: solo la pueden usar los microservicios.' });
    return false;
  }
  return true;
}

// ---------- Consultas frecuentes a users-service ----------

/** Personas por id, como un Map id → { id, name, document, email, phone, roles, plan, status }. */
export async function peopleById(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const data = await callService('users', `/internal/people?ids=${encodeURIComponent(unique.join(','))}`);
  return new Map(data.items.map(person => [person.id, person]));
}

export async function personByDocument(document) {
  const value = String(document || '').trim();
  if (!value) return null;
  const data = await callService('users', `/internal/people?document=${encodeURIComponent(value)}`);
  return data.items[0] || null;
}

/** Acepta un documento o un id de afiliado y devuelve la persona (o null). */
export async function resolvePerson(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const byDocument = await personByDocument(text);
  if (byDocument) return byDocument;
  return (await peopleById([text])).get(text) || null;
}
