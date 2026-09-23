PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dim_plans (
  plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  regime TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_affiliates (
  affiliate_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'affiliate',
  status TEXT NOT NULL DEFAULT 'active',
  plan_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES dim_plans(plan_id)
);

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

CREATE TABLE IF NOT EXISTS fact_appointments (
  appointment_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  service_id INTEGER,
  date_key TEXT,
  specialty TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id),
  FOREIGN KEY (service_id) REFERENCES dim_services(service_id),
  FOREIGN KEY (date_key) REFERENCES dim_dates(date_key)
);

CREATE TABLE IF NOT EXISTS fact_authorizations (
  authorization_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  service_id INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id),
  FOREIGN KEY (service_id) REFERENCES dim_services(service_id)
);

CREATE TABLE IF NOT EXISTS fact_pqrs (
  pqrs_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id)
);

CREATE TABLE IF NOT EXISTS fact_notifications (
  notification_id TEXT PRIMARY KEY,
  affiliate_id TEXT,
  event_type TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id)
);

CREATE TABLE IF NOT EXISTS content_items (
  content_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS fact_medication_dispensations (
  dispensation_id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  status TEXT NOT NULL,
  dispensed_at TEXT,
  delivery_point TEXT,
  FOREIGN KEY (prescription_id) REFERENCES fact_prescriptions(prescription_id),
  FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id)
);

CREATE TABLE IF NOT EXISTS fact_lab_results (
  lab_result_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  test_name TEXT NOT NULL,
  result TEXT,
  status TEXT NOT NULL,
  result_date TEXT,
  FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id)
);

CREATE INDEX IF NOT EXISTS idx_appointments_affiliate ON fact_appointments(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_authorizations_affiliate ON fact_authorizations(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_affiliate ON fact_pqrs(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_notifications_affiliate ON fact_notifications(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_affiliate ON fact_prescriptions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_dispensations_affiliate ON fact_medication_dispensations(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_affiliate ON fact_lab_results(affiliate_id);
