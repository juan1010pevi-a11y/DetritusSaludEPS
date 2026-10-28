-- Base de datos de PQRS SERVICE (pqrs.sqlite)
-- Peticiones, quejas, reclamos, sugerencias y denuncias con su historial de estados.

CREATE TABLE IF NOT EXISTS fact_pqrs (
  pqrs_id TEXT PRIMARY KEY,              -- radicado PQRS-AAAA-NNNNNN
  affiliate_id TEXT,                     -- referencia lógica a users-service (NULL si no es afiliado)
  type TEXT NOT NULL CHECK (type IN ('Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Denuncia')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'CC',
  document TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'in_review', 'answered', 'closed')),
  response TEXT,
  responded_by TEXT,
  responded_at TEXT,
  due_date TEXT NOT NULL,                -- fecha límite legal de respuesta (días hábiles)
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS pqrs_status_history (
  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  pqrs_id TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  changed_by TEXT,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (pqrs_id) REFERENCES fact_pqrs(pqrs_id)
);

CREATE INDEX IF NOT EXISTS idx_pqrs_affiliate ON fact_pqrs(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_document ON fact_pqrs(document);
CREATE INDEX IF NOT EXISTS idx_pqrs_status ON fact_pqrs(status);
