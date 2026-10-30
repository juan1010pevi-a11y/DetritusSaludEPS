import './env.js'; // primero: credenciales de backend/.env
import { startService, json, readJson } from './service.js';
import { createDatabase } from './database.js';
import { requireRole } from './auth.js';

const NEWS = [
  [1, 'Jornada de vacunación contra la influenza 2026', 'Información de campaña', 'Campaña', '/img/madres-gestantes.jpg'],
  [2, 'Recursos de salud mental disponibles para ti', 'Información de bienestar', 'Bienestar', '/img/atencion-usuario.jpg'],
  [3, 'Telemedicina: consulta desde donde estés', 'Conoce nuestras opciones de atención virtual.', 'Servicios', '/img/medicina-domiciliaria.jpg'],
  [4, 'Prevención y control de la hipertensión', 'Pequeños hábitos pueden proteger tu salud cardiovascular.', 'Prevención', '/img/medicamentos.jpg'],
  [5, 'Nuevos puntos de atención para afiliados', 'Encuentra servicios más cerca de tu hogar.', 'Novedades', '/img/puntos-atencion.jpg'],
];

const db = await createDatabase('content', {
  seed(database) {
    for (const news of NEWS) {
      database.execute('INSERT OR IGNORE INTO content_items (content_id, title, body, category, image) VALUES (?, ?, ?, ?, ?)', news);
    }
  },
});
const { execute, queryOne, queryRows } = db;

startService({
  name: 'content-service',
  serviceKey: 'content',
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'content-service', status: 'ok', database: db.file }),
    },
    {
      method: 'GET',
      path: '/news',
      handler: (_req, res) => json(res, 200, { items: queryRows(
        `SELECT content_id AS id, title, body, category AS tag, image, published_at AS publishedAt
         FROM content_items ORDER BY published_at DESC, content_id`,
      ) }),
    },
    {
      method: 'POST',
      path: '/news',
      handler: async (req, res) => {
        if (!requireRole(req, res, ['administrator'])) return;
        const data = await readJson(req);
        const title = String(data.title || '').trim();
        const body = String(data.body || '').trim();
        const category = String(data.category || 'General').trim();
        if (title.length < 5 || body.length < 10) return json(res, 400, { error: 'Título (mínimo 5 caracteres) y contenido (mínimo 10) son obligatorios.' });
        execute('INSERT INTO content_items (title, body, category, image) VALUES (?, ?, ?, ?)', [title, body, category, data.image || null]);
        const { id } = queryOne('SELECT MAX(content_id) AS id FROM content_items');
        return json(res, 201, { id, title, body, category });
      },
    },
    {
      method: 'PATCH',
      path: '/news',
      handler: async (req, res, url) => {
        if (!requireRole(req, res, ['administrator'])) return;
        const data = await readJson(req);
        const id = url.searchParams.get('id') || data.id;
        if (!queryOne('SELECT content_id FROM content_items WHERE content_id = ?', [id])) return json(res, 404, { error: 'Contenido no encontrado' });
        execute(
          `UPDATE content_items SET title = COALESCE(?, title), body = COALESCE(?, body), category = COALESCE(?, category), image = COALESCE(?, image)
           WHERE content_id = ?`,
          [data.title || null, data.body || null, data.category || null, data.image || null, id],
        );
        return json(res, 200, { updated: true, id });
      },
    },
  ],
});
