-- Base de datos de NOTIFICATIONS SERVICE (notifications.sqlite)
-- Bandeja de salida: una fila por cada mensaje enviado por correo, SMS o WhatsApp.

CREATE TABLE IF NOT EXISTS fact_notifications (
  notification_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,                -- agrupa los mensajes de un mismo evento
  affiliate_id TEXT,                     -- referencia lógica a users-service (sin FK: otra base)
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  recipient TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'simulated', 'failed', 'skipped')),
  provider TEXT,
  error TEXT,
  reference TEXT,                        -- radicado, número de cita, fórmula…
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_affiliate ON fact_notifications(affiliate_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON fact_notifications(event_id);
