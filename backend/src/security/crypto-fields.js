import crypto from 'node:crypto';
import { requireSecret } from './secrets.js';

/**
 * Cifrado de campos sensibles en reposo con AES-256-GCM (confidencialidad + integridad).
 * Formato guardado en la base:  enc:v1:<iv>.<tag>.<datos>  (base64url)
 *
 * - `seal(texto)` cifra antes de guardar (se usa en los INSERT/UPDATE de datos clínicos).
 * - `open(valor)` descifra; si el valor no está cifrado lo devuelve igual.
 * - database.js llama a `openRow` en cada lectura, así las consultas existentes reciben
 *   el texto claro sin cambiar el SQL.
 */

export const PREFIX = 'enc:v1:';
let key = null;

function dataKey() {
  if (!key) {
    key = Buffer.from(requireSecret('DATA_KEY'), 'base64');
    if (key.length !== 32) throw new Error('DATA_KEY debe ser de 32 bytes en base64 (44 caracteres).');
  }
  return key;
}

export const isSealed = value => typeof value === 'string' && value.startsWith(PREFIX);

export function seal(value) {
  if (value === null || value === undefined || value === '' || isSealed(value)) return value ?? null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey(), iv);
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `${PREFIX}${[iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.')}`;
}

export function open(value) {
  if (!isSealed(value)) return value;
  try {
    const [iv, tag, data] = value.slice(PREFIX.length).split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Llave equivocada o dato alterado: nunca se devuelve el texto cifrado como si fuera válido.
    return '[dato protegido: no se pudo descifrar]';
  }
}

export function openRow(row) {
  if (!row) return row;
  for (const [column, value] of Object.entries(row)) if (isSealed(value)) row[column] = open(value);
  return row;
}

/**
 * Cifra los valores que aún estén en texto claro (migración de bases existentes).
 * `columns` = { tabla: ['col1', 'col2'] }. La clave primaria se toma de `ids`.
 */
export function sealExistingColumns(db, columns, ids) {
  let total = 0;
  db.transaction(() => {
  for (const [table, list] of Object.entries(columns)) {
    const idColumn = ids[table];
    for (const column of list) {
      const rows = db.rawRows(`SELECT ${idColumn} AS id, ${column} AS value FROM ${table}
        WHERE ${column} IS NOT NULL AND ${column} <> '' AND ${column} NOT LIKE '${PREFIX}%'`);
      for (const row of rows) {
        db.execute(`UPDATE ${table} SET ${column} = ? WHERE ${idColumn} = ?`, [seal(String(row.value)), row.id]);
        total += 1;
      }
    }
  }
  });
  if (total) console.log(`[${db.name}] ${total} campo(s) sensibles cifrados con AES-256-GCM.`);
  return total;
}
