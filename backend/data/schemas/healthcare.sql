-- Base de datos de HEALTHCARE SERVICE (healthcare.sqlite)
-- Médicos, horarios, ausencias (incapacidades), citas, autorizaciones e historia clínica.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dim_services (
  service_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_dates (
  date_key TEXT PRIMARY KEY,
  date_value TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL
);

-- Ficha profesional. doctor_id = id de la persona en users-service.
CREATE TABLE IF NOT EXISTS dim_doctors (
  doctor_id TEXT PRIMARY KEY,
  specialty TEXT NOT NULL,
  license TEXT,
  site TEXT,
  slot_minutes INTEGER NOT NULL DEFAULT 20 CHECK (slot_minutes BETWEEN 10 AND 120),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS doctor_schedules (
  schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  UNIQUE (doctor_id, weekday, start_time),
  FOREIGN KEY (doctor_id) REFERENCES dim_doctors(doctor_id)
);

-- Incapacidades, vacaciones y licencias: el médico no recibe citas en esas fechas.
CREATE TABLE IF NOT EXISTS doctor_absences (
  absence_id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('incapacidad', 'vacaciones', 'licencia', 'calamidad', 'capacitacion')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  cancelled_at TEXT,
  CHECK (end_date >= start_date),
  FOREIGN KEY (doctor_id) REFERENCES dim_doctors(doctor_id)
);

CREATE TABLE IF NOT EXISTS fact_appointments (
  appointment_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,            -- referencia lógica a users-service
  service_id INTEGER,
  date_key TEXT,
  specialty TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL CHECK (status IN ('requested', 'confirmed', 'completed', 'no_show', 'cancelled', 'reschedule_required')),
  doctor_id TEXT,
  modality TEXT,
  site TEXT,
  exam_code TEXT,
  lab_order_number TEXT,
  reason TEXT,
  diagnosis TEXT,
  clinical_notes TEXT,
  change_note TEXT,                      -- explica reasignaciones / reprogramaciones al paciente
  original_doctor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  FOREIGN KEY (service_id) REFERENCES dim_services(service_id),
  FOREIGN KEY (date_key) REFERENCES dim_dates(date_key),
  FOREIGN KEY (doctor_id) REFERENCES dim_doctors(doctor_id)
);

CREATE TABLE IF NOT EXISTS fact_authorizations (
  authorization_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  service_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'denied')),
  service_code TEXT,
  service_name TEXT,
  category TEXT,
  ordered_by TEXT,
  order_reference TEXT,
  reason TEXT,
  priority TEXT,
  auth_number TEXT,
  provider TEXT,
  valid_until TEXT,
  decided_by TEXT,
  decided_at TEXT,
  decision_notes TEXT,
  appointment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES dim_services(service_id),
  FOREIGN KEY (appointment_id) REFERENCES fact_appointments(appointment_id)
);

-- Historia clínica: antecedentes del paciente (una fila por paciente)…
CREATE TABLE IF NOT EXISTS clinical_backgrounds (
  patient_id TEXT PRIMARY KEY,
  blood_type TEXT CHECK (blood_type IS NULL OR blood_type IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
  allergies TEXT,
  personal_history TEXT,
  family_history TEXT,
  surgical_history TEXT,
  current_medications TEXT,
  habits TEXT,
  updated_by TEXT,
  updated_at TEXT
);

-- …y una evolución (registro de atención) por cada cita atendida.
CREATE TABLE IF NOT EXISTS clinical_encounters (
  encounter_id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  encounter_date TEXT NOT NULL,
  chief_complaint TEXT,                  -- motivo de consulta
  current_illness TEXT,                  -- enfermedad actual
  blood_pressure TEXT,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  temperature REAL,
  weight_kg REAL,
  height_cm REAL,
  oxygen_saturation INTEGER,
  physical_exam TEXT,
  diagnosis TEXT NOT NULL,
  diagnosis_code TEXT,                   -- CIE-10
  plan TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (appointment_id) REFERENCES fact_appointments(appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_appointments_affiliate ON fact_appointments(affiliate_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON fact_appointments(doctor_id, appointment_date);
-- Un médico no puede tener dos citas activas que empiecen en el mismo cupo.
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_doctor_slot
  ON fact_appointments(doctor_id, appointment_date, appointment_time)
  WHERE status NOT IN ('cancelled', 'reschedule_required') AND doctor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_authorizations_affiliate ON fact_authorizations(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_absences_doctor ON doctor_absences(doctor_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_encounters_patient ON clinical_encounters(patient_id, encounter_date);
