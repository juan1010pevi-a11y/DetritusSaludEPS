import { SERVICE_LABELS as LABELS, serviceUrl } from './config.js';
import { getCurrentService, HttpError, json } from './service.js';
import { requireSecret } from './security/secrets.js';
import { signJwt, verifyJwt } from './security/tokens.js';

/**
 * Comunicación síncrona entre microservicios. Como cada servicio tiene su propia
 * base de datos, cuando uno necesita información de otro (por ejemplo, el nombre
 * de un paciente que vive en users-service) la pide por HTTP a una ruta /internal/*.
 * El API Gateway nunca expone esas rutas al navegador y además exigen un TOKEN DE SERVICIO:
 * un JWT de 60 segundos firmado con INTERNAL_KEY cuya audiencia (aud) es el servicio destino.
 * Así un token capturado no sirve para llamar a otro microservicio ni más tarde (Zero Trust).
 */
const INTERNAL_KEY = requireSecret('INTERNAL_KEY');
const SERVICE_TOKEN_SECONDS = 60;
const ISSUER_PREFIX = 'detritus-service:';

export function serviceToken(target) {
  return signJwt({ sub: getCurrentService() || 'gateway' }, {
    secret: INTERNAL_KEY,
    issuer: `${ISSUER_PREFIX}${getCurrentService() || 'gateway'}`,
    audience: `${ISSUER_PREFIX}${target}`,
    expiresInSeconds: SERVICE_TOKEN_SECONDS,
  });
}
// ---------- Tolerancia a fallos en las llamadas internas ----------
// 1) Cortacircuitos (circuit breaker): tras 3 fallas seguidas de conexión con un servicio, durante
//    15 s no se le vuelve a llamar y se responde 503 de inmediato (no se espera el timeout).
// 2) Caché de último valor conocido (stale-if-error) SOLO para consultas de lectura de personas y
//    médicos: si users-service está apagado, citas, fórmulas y PQRS siguen mostrando nombres.
const BREAKER_FAILURES = 3;
const BREAKER_OPEN_MS = 15000;
const breakers = new Map(); // servicio → { failures, openUntil }
const STALE_PATHS = ['/internal/people', '/internal/doctors'];
const STALE_MAX_MS = 30 * 60000;
const STALE_MAX_ENTRIES = 500;
const staleCache = new Map(); // `${servicio}${ruta}` → { data, at }

const unavailable = service => new HttpError(503,
  `El servicio de ${LABELS[service] || service} no está disponible en este momento. El resto del portal sigue funcionando.`,
  { service, unavailable: true });

function remember(key, data) {
  staleCache.delete(key);
  staleCache.set(key, { data, at: Date.now() });
  if (staleCache.size > STALE_MAX_ENTRIES) staleCache.delete(staleCache.keys().next().value);
}

export function breakerStatus() {
  return Object.fromEntries([...breakers].map(([service, state]) => [service, state.openUntil > Date.now() ? 'abierto' : 'cerrado']));
}

export async function callService(service, path, { method = 'GET', body, timeout = 5000 } = {}) {
  const breaker = breakers.get(service) || { failures: 0, openUntil: 0 };
  breakers.set(service, breaker);
  const cacheKey = `${service}${path}`;
  const cacheable = method === 'GET' && STALE_PATHS.some(prefix => path.startsWith(prefix));
  const fallback = () => {
    const cached = cacheable && staleCache.get(cacheKey);
    if (cached && Date.now() - cached.at < STALE_MAX_MS) {
      console.warn(`[degradado] ${service} no responde; se usa la última copia de ${path.split('?')[0]}.`);
      return cached.data;
    }
    throw unavailable(service);
  };

  if (breaker.openUntil > Date.now()) return fallback();
  let response;
  try {
    response = await fetch(`${serviceUrl(service)}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-service-token': serviceToken(service) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    breaker.failures += 1;
    if (breaker.failures >= BREAKER_FAILURES) {
      breaker.openUntil = Date.now() + BREAKER_OPEN_MS;
      console.warn(`[cortacircuitos] ${service} falló ${breaker.failures} veces seguidas; se deja de llamar por ${BREAKER_OPEN_MS / 1000} s.`);
    }
    return fallback();
  }
  breaker.failures = 0;
  breaker.openUntil = 0;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status, data.error || `El microservicio ${service} respondió ${response.status}.`, data);
  if (cacheable) remember(cacheKey, data);
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

/** Devuelve el nombre del servicio que llama si el token de servicio es válido; si no, null. */
export function verifyServiceToken(req, target = getCurrentService()) {
  const claims = verifyJwt(String(req.headers['x-service-token'] || ''), {
    secret: INTERNAL_KEY,
    audience: `${ISSUER_PREFIX}${target}`,
  });
  if (!claims || !String(claims.iss || '').startsWith(ISSUER_PREFIX)) return null;
  return claims.sub;
}

export function requireInternal(req, res) {
  if (!verifyServiceToken(req)) {
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
