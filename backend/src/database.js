import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { hashPassword } from './security.js';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(srcDir, '..');
const dataDir = path.join(backendDir, 'data');
const databasePath = path.join(dataDir, 'detritus.sqlite');
const schemaPath = path.join(dataDir, 'schema.sql');

let database;
let sqlEngine;
let loadedMtime = 0;

export async function initDatabase() {
  if (database) return database;

  fs.mkdirSync(dataDir, { recursive: true });
  const SQL = await initSqlJs({
    locateFile: file => path.join(backendDir, 'node_modules', 'sql.js', 'dist', file),
  });
  sqlEngine = SQL;
  database = fs.existsSync(databasePath)
    ? new SQL.Database(fs.readFileSync(databasePath))
    : new SQL.Database();

  database.exec(fs.readFileSync(schemaPath, 'utf8'));
  ensureAffiliateContactColumns();
  ensureContentImageColumn();
  ensureMedsLabsTables();
  seedDatabase();
  persistDatabase();
  console.log(`SQLite conectada: ${databasePath}`);
  return database;
}

function ensureContentImageColumn() {
  const statement = database.prepare('PRAGMA table_info(content_items)');
  const columns = [];
  while (statement.step()) columns.push(statement.getAsObject().name);
  statement.free();
  if (!columns.includes('image')) database.run('ALTER TABLE content_items ADD COLUMN image TEXT');
}

function ensureAffiliateContactColumns() {
  const statement = database.prepare('PRAGMA table_info(dim_affiliates)');
  const columns = [];
  while (statement.step()) columns.push(statement.getAsObject().name);
  statement.free();
  if (!columns.includes('email')) database.run('ALTER TABLE dim_affiliates ADD COLUMN email TEXT');
  if (!columns.includes('phone')) database.run('ALTER TABLE dim_affiliates ADD COLUMN phone TEXT');
  if (!columns.includes('whatsapp_opt_in')) database.run('ALTER TABLE dim_affiliates ADD COLUMN whatsapp_opt_in INTEGER NOT NULL DEFAULT 0');
}

function ensureMedsLabsTables() {
  database.run(`
    CREATE TABLE IF NOT EXISTS fact_prescriptions (
      prescription_id TEXT PRIMARY KEY,
      affiliate_id TEXT NOT NULL,
      prescription_number TEXT NOT NULL UNIQUE,
      medication_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      delivery_point TEXT,
      FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id)
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS fact_medication_dispensations (
      dispensation_id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      affiliate_id TEXT NOT NULL,
      status TEXT NOT NULL,
      dispensed_at TEXT,
      delivery_point TEXT,
      FOREIGN KEY (prescription_id) REFERENCES fact_prescriptions(prescription_id),
      FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id)
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS fact_lab_results (
      lab_result_id TEXT PRIMARY KEY,
      affiliate_id TEXT NOT NULL,
      order_number TEXT NOT NULL UNIQUE,
      test_name TEXT NOT NULL,
      result TEXT,
      status TEXT NOT NULL,
      result_date TEXT,
      FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id)
    )
  `);
}

function seedDatabase() {
  database.run(
    `INSERT OR IGNORE INTO dim_plans (name, regime) VALUES (?, ?)`,
    ['Régimen contributivo', 'contributivo'],
  );

  const demoPassword = 'demo123';
  const demoHash = hashPassword(demoPassword);
  database.run(
    `INSERT OR IGNORE INTO dim_affiliates
      (affiliate_id, name, document, password, role, status, plan_id)
     SELECT ?, ?, ?, ?, ?, ?, plan_id
     FROM dim_plans WHERE name = ?`,
    ['user-001', 'Afiliado demo', '123456789', demoHash, 'affiliate', 'active', 'Régimen contributivo'],
  );
  const staffUsers = [
    ['staff-doctor', 'Médico demo', '900000001', hashPassword('doctor123'), 'doctor'],
    ['staff-admin', 'Administrador demo', '900000002', hashPassword('admin123'), 'administrator'],
  ];
  for (const [id, name, document, password, role] of staffUsers) {
    database.run(
      `INSERT OR IGNORE INTO dim_affiliates
        (affiliate_id, name, document, password, role, status, plan_id)
       SELECT ?, ?, ?, ?, ?, 'active', plan_id
       FROM dim_plans WHERE name = ?`,
      [id, name, document, password, role, 'Régimen contributivo'],
    );
  }
  database.run(
    `UPDATE dim_affiliates SET email = ?, phone = ? WHERE affiliate_id = ?`,
    ['afiliado.demo@example.com', '+573001234567', 'user-001'],
  );
  database.run(
    `INSERT OR IGNORE INTO dim_services (name, category) VALUES (?, ?)`,
    ['Consulta medicina general', 'consulta'],
  );
  database.run(
    `INSERT OR IGNORE INTO fact_prescriptions
      (prescription_id, affiliate_id, prescription_number, medication_name, dosage, quantity, status, issued_at, delivery_point)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['FAR-001', 'user-001', 'FAR-2026-1234', 'Losartán 50 mg', '1 tableta cada 12 horas', 60,
      'available', '2026-09-20', 'Droguería aliada Calle 80'],
  );
  database.run(
    `INSERT OR IGNORE INTO fact_lab_results
      (lab_result_id, affiliate_id, order_number, test_name, result, status, result_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['LAB-001', 'user-001', 'LAB-2026-123456', 'Hemograma completo', 'Resultados disponibles en el portal de la IPS',
      'available', '2026-09-22'],
  );
}

export function getDatabase() {
  if (!database) throw new Error('SQLite aún no ha sido inicializada');
  return database;
}

export function refreshDatabase() {
  if (!database || !fs.existsSync(databasePath)) return;
  const currentMtime = fs.statSync(databasePath).mtimeMs;
  if (currentMtime <= loadedMtime) return;
  database = new sqlEngine.Database(fs.readFileSync(databasePath));
  loadedMtime = currentMtime;
}

export function persistDatabase() {
  if (!database) return;
  fs.writeFileSync(databasePath, Buffer.from(database.export()));
  loadedMtime = fs.statSync(databasePath).mtimeMs;
}

export function queryRows(sql, params = []) {
  const statement = getDatabase().prepare(sql);
  statement.bind(params);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

export function queryOne(sql, params = []) {
  return queryRows(sql, params)[0] || null;
}

export function execute(sql, params = []) {
  const db = getDatabase();
  db.run(sql, params);
  persistDatabase();
  return db.getRowsModified();
}
