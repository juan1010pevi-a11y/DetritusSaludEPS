import './env.js'; // credenciales de backend/.env antes de leer cualquier variable
// Puertos y hosts de cada microservicio. Se pueden cambiar con variables de entorno
// (por ejemplo, en docker-compose cada servicio tiene su propio host y en las pruebas
// automáticas se usa BASE_PORT para no chocar con el backend de desarrollo).
const BASE_PORT = Number(process.env.BASE_PORT || 4000);

const SERVICE_ORDER = ['auth', 'users', 'content', 'notifications', 'healthcare', 'pqrs', 'meds-labs'];

const envKey = name => name.toUpperCase().replace(/-/g, '_');

export const SERVICES = Object.fromEntries(SERVICE_ORDER.map((name, index) => [name, {
  name,
  host: process.env[`${envKey(name)}_HOST`] || 'localhost',
  port: Number(process.env[`${envKey(name)}_PORT`] || BASE_PORT + index + 1),
}]));

export const GATEWAY_PORT = Number(process.env.GATEWAY_PORT || BASE_PORT);

export function serviceUrl(name) {
  const service = SERVICES[name];
  if (!service) throw new Error(`Servicio desconocido: ${name}`);
  return `http://${service.host}:${service.port}`;
}

export const SERVICE_NAMES = SERVICE_ORDER;
