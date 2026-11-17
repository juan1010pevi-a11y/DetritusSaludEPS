import { HttpError } from '../service.js';

/**
 * Validación de entradas con esquemas declarativos (misma idea que zod/ajv, sin dependencias).
 *
 *   const LoginSchema = object({ document: string({ max: 12 }), password: string({ max: 128 }), role: optional(oneOf(ROLES)) });
 *   const data = parse(LoginSchema, await readJson(req));
 *
 * Los campos que no están en el esquema se descartan (evita "mass assignment").
 */

const fail = message => { throw new HttpError(400, message); };

export const string = ({ min = 0, max = 500, pattern, label = 'El campo', trim = true } = {}) => (value, name) => {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') fail(`${label} (${name}) debe ser texto.`);
  const text = trim ? String(value).trim() : String(value);
  if (text.length < min) fail(min === 1 ? `${label} (${name}) es obligatorio.` : `${label} (${name}) debe tener al menos ${min} caracteres.`);
  if (text.length > max) fail(`${label} (${name}) supera los ${max} caracteres permitidos.`);
  if (pattern && text && !pattern.test(text)) fail(`${label} (${name}) no tiene un formato válido.`);
  return text;
};

export const boolean = () => (value, name) => {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') fail(`El campo ${name} debe ser verdadero o falso.`);
  return value;
};

export const oneOf = (values, label = 'El valor') => (value, name) => {
  if (!values.includes(value)) fail(`${label} (${name}) no es válido.`);
  return value;
};

export const optional = validator => (value, name) => (value === undefined || value === null || value === '' ? undefined : validator(value, name));

export const object = shape => (value, name = 'cuerpo') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`El ${name} de la solicitud debe ser un objeto JSON.`);
  const result = {};
  for (const [key, validator] of Object.entries(shape)) {
    const parsed = validator(value[key], key);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
};

export const parse = (schema, value) => schema(value);
