import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { openRow } from './security/crypto-fields.js';

/**
 * Patrón "Database per Service": cada microservicio abre SU PROPIA base SQLite
 * (data/db/<servicio>.sqlite) con SU PROPIO esquema (data/schemas/<servicio>.sql).
 * Ningún servicio lee las tablas de otro: si necesita un dato ajeno lo pide por
 * HTTP al dueño (ver internal.js) o lo recibe por un evento de RabbitMQ.
 */
const srcDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(srcDir, '..');
const schemasDir = path.join(backendDir, 'data', 'schemas');
const require = createRequire(import.meta.url);

export function dataDirectory() {
  return path.resolve(process.env.DATA_DIR || path.join(backendDir, 'data', 'db'));
}

let enginePromise;
function sqlEngine() {
  enginePromise ||= initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
  return enginePromise;
}

// Nombres de tabla/columna solo pueden venir del código (nunca del usuario): se validan igual.
function assertIdentifier(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name))) throw new Error(`Identificador SQL no permitido: ${name}`);
}

export async function createDatabase(name, { migrate, seed } = {}) {
  const SQL = await sqlEngine();
  const dataDir = dataDirectory();
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, `${name}.sqlite`);
  const database = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  let inTransaction = false;

  const persist = () => {
    if (inTransaction) return;
    // 0o600: solo el usuario del servicio puede leer el archivo de la base.
    fs.writeFileSync(file, Buffer.from(database.export()), { mode: 0o600 });
  };

  // Lectura sin descifrar (solo para migraciones de cifrado).
  const rawRows = (sql, params = []) => {
    const statement = database.prepare(sql);
    statement.bind(params);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    statement.free();
    return rows;
  };
  // Los campos cifrados con AES-256-GCM (enc:v1:…) se descifran al leer.
  const queryRows = (sql, params = []) => rawRows(sql, params).map(openRow);

  const db = {
    name,
    file,
    queryRows,
    rawRows,
    queryOne: (sql, params = []) => queryRows(sql, params)[0] || null,
    /** Ejecuta una sentencia y guarda el archivo. Devuelve cuántas filas cambió. */
    execute(sql, params = []) {
      database.run(sql, params);
      const changes = database.getRowsModified();
      persist();
      return changes;
    },
    /** Ejecuta varias sentencias de forma atómica: o se guardan todas o ninguna. */
    transaction(work) {
      database.run('BEGIN');
      inTransaction = true;
      try {
        const result = work();
        database.run('COMMIT');
        inTransaction = false;
        persist();
        return result;
      } catch (error) {
        database.run('ROLLBACK');
        inTransaction = false;
        throw error;
      }
    },
    columnsOf(table) {
      assertIdentifier(table);
      return queryRows(`PRAGMA table_info(${table})`).map(row => row.name);
    },
    addColumnIfMissing(table, column, definition) {
      assertIdentifier(table); assertIdentifier(column);
      if (!db.columnsOf(table).includes(column)) database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    },
    close() {
      database.close();
    },
  };

  database.exec(fs.readFileSync(path.join(schemasDir, `${name}.sql`), 'utf8'));
  migrate?.(db);
  seed?.(db);
  persist();
  console.log(`[${name}] base de datos propia: ${file}`);
  return db;
}
