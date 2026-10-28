-- Base de datos de CONTENT SERVICE (content.sqlite)
-- Noticias y campañas que se publican en la página de inicio.

CREATE TABLE IF NOT EXISTS content_items (
  content_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
