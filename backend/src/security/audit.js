import crypto from 'node:crypto';

/**
 * Auditoría de accesos a datos clínicos (Resolución 1995 de 1999: la historia clínica es
 * reservada y debe saberse quién la consultó). Cada servicio clínico guarda su propia
 * tabla audit_log en SU base de datos (Database per Service).
 */

export function enableAudit(db) {
  db.execute(`CREATE TABLE IF NOT EXISTS audit_log (
    audit_id TEXT PRIMARY KEY,
    occurred_at TEXT NOT NULL,
    actor_id TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    patient_id TEXT,
    outcome TEXT NOT NULL DEFAULT 'allowed',
    ip TEXT,
    request_id TEXT
  )`);
  db.execute('CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit_log(patient_id, occurred_at)');
  db.execute('CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, occurred_at)');

  /** Registra un acceso. Nunca rompe la petición si falla el registro. */
  return function audit(req, user, { action, resource, resourceId = null, patientId = null, outcome = 'allowed' }) {
    try {
      db.execute(
        `INSERT INTO audit_log (audit_id, occurred_at, actor_id, actor_role, action, resource, resource_id, patient_id, outcome, ip, request_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), new Date().toISOString(), user?.sub || null, user?.role || (user ? null : 'anonymous'), action, resource,
          resourceId ? String(resourceId) : null, patientId || null, outcome,
          String(req?.headers?.['x-client-ip'] || '').slice(0, 64) || null,
          String(req?.headers?.['x-request-id'] || '').slice(0, 64) || null],
      );
    } catch (error) {
      console.warn(`[auditoría] no se pudo registrar ${action}: ${error.message}`);
    }
  };
}

/** Consulta del registro para el administrador (más reciente primero). */
export function listAudit(db, { patientId, actorId, limit = 200 } = {}) {
  const filters = [];
  const params = [];
  if (patientId) { filters.push('patient_id = ?'); params.push(patientId); }
  if (actorId) { filters.push('actor_id = ?'); params.push(actorId); }
  params.push(Math.min(Math.max(Number(limit) || 200, 1), 1000));
  return db.queryRows(
    `SELECT audit_id AS id, occurred_at AS occurredAt, actor_id AS actorId, actor_role AS actorRole, action, resource,
            resource_id AS resourceId, patient_id AS patientId, outcome, ip, request_id AS requestId
     FROM audit_log ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY occurred_at DESC LIMIT ?`,
    params,
  );
}
