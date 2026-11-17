-- Base de datos de AUTH SERVICE (auth.sqlite)
-- Seguridad del acceso: intentos de inicio de sesión (bloqueo por fuerza bruta)
-- y códigos de recuperación de contraseña. Las credenciales las valida users-service.

CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  document TEXT NOT NULL,
  success INTEGER NOT NULL CHECK (success IN (0, 1)),
  attempted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  reset_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document TEXT NOT NULL,
  code_hash TEXT NOT NULL,               -- el código de 6 dígitos se guarda con hash
  channels TEXT NOT NULL,                -- canales por los que se envió (email, sms, whatsapp)
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_document ON login_attempts(document, attempted_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_document ON password_resets(document, created_at);

-- Sesiones largas: refresh tokens (se guarda solo el SHA-256, nunca el token).
-- Rotación: cada uso crea uno nuevo y revoca el anterior. Reusar uno revocado revoca la familia.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  mfa INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT,
  user_agent TEXT
);

-- Verificación en dos pasos (TOTP). El secreto se guarda cifrado con AES-256-GCM.
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id TEXT PRIMARY KEY,
  secret TEXT,
  pending_secret TEXT,
  enabled_at TEXT,
  last_step INTEGER NOT NULL DEFAULT -1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens(family_id);
