-- Base de datos de MEDS-LABS SERVICE (meds-labs.sqlite)
-- Fórmulas médicas, entregas de farmacia y órdenes / documentos de laboratorio.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fact_prescriptions (
  prescription_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,            -- referencia lógica a users-service
  prescription_number TEXT NOT NULL UNIQUE,
  formula_number TEXT NOT NULL,          -- una fórmula agrupa uno o varios medicamentos
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 360),
  status TEXT NOT NULL CHECK (status IN ('pending', 'available', 'delivered', 'cancelled')),
  issued_at TEXT NOT NULL,
  delivery_point TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  appointment_id TEXT,                   -- referencia lógica a healthcare-service
  instructions TEXT,
  valid_until TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS fact_medication_dispensations (
  dispensation_id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  status TEXT NOT NULL,
  dispensed_at TEXT,
  delivery_point TEXT,
  FOREIGN KEY (prescription_id) REFERENCES fact_prescriptions(prescription_id)
);

CREATE TABLE IF NOT EXISTS fact_lab_results (
  lab_result_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  test_name TEXT NOT NULL,
  exam_code TEXT,
  result TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'processing', 'available', 'cancelled', 'pending')),
  result_date TEXT,
  appointment_id TEXT,
  appointment_date TEXT,                 -- copia de la cita para mostrar el documento sin consultar otra base
  appointment_time TEXT,
  site TEXT,
  sample_type TEXT,
  sample_taken_at TEXT,
  sample_taken_by TEXT,
  validated_by TEXT,
  validated_at TEXT,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS fact_lab_result_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_result_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  parameter TEXT NOT NULL,
  value TEXT,
  unit TEXT,
  reference_range TEXT,
  flag TEXT,
  UNIQUE (lab_result_id, position),
  FOREIGN KEY (lab_result_id) REFERENCES fact_lab_results(lab_result_id)
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_affiliate ON fact_prescriptions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_formula ON fact_prescriptions(formula_number);
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON fact_prescriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_affiliate ON fact_lab_results(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_appointment ON fact_lab_results(appointment_id);
