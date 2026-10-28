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
