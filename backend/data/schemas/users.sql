-- Base de datos de USERS SERVICE (users.sqlite)
-- Dueño de la identidad: personas, credenciales, perfiles de acceso, planes y beneficiarios.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dim_plans (
  plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  regime TEXT NOT NULL
);

-- Una fila por persona (afiliado, médico o administrador). `document` es único.
CREATE TABLE IF NOT EXISTS dim_affiliates (
  affiliate_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT NOT NULL UNIQUE CHECK (length(document) BETWEEN 5 AND 12),
  password TEXT NOT NULL,                -- hash PBKDF2 (sal:hash), nunca la contraseña en texto
  email TEXT,
  phone TEXT,
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'affiliate',
  status TEXT NOT NULL DEFAULT 'active',
  plan_id INTEGER NOT NULL,
  document_type TEXT DEFAULT 'CC',
  first_name TEXT, second_name TEXT, first_surname TEXT, second_surname TEXT,
  birth_date TEXT, sex TEXT,
  department TEXT, city TEXT, zone TEXT, address TEXT, neighborhood TEXT, landline TEXT,
  affiliate_type TEXT, employer_name TEXT, employer_nit TEXT, base_income TEXT,
  economic_activity TEXT, pension_fund TEXT, sisben_group TEXT, previous_eps TEXT,
  primary_ips TEXT, filing_number TEXT, effective_date TEXT,
  password_changed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES dim_plans(plan_id)
);

-- Perfiles de acceso: una persona puede ser afiliada y médica a la vez.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('affiliate', 'doctor', 'administrator')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES dim_affiliates(affiliate_id)
);

CREATE TABLE IF NOT EXISTS dim_beneficiaries (
  beneficiary_id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  sex TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_type, document),
  FOREIGN KEY (affiliate_id) REFERENCES dim_affiliates(affiliate_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
