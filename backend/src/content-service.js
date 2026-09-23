import { startService, json, readJson } from './service.js';
import { execute, initDatabase, queryOne, queryRows, refreshDatabase } from './database.js';

await initDatabase();

execute(
  `INSERT OR IGNORE INTO content_items (content_id, title, body, category, image)
   VALUES (?, ?, ?, ?, ?)`,
  [1, 'Jornada de vacunación contra la influenza 2026', 'Información de campaña', 'Campaña', '/img/madres-gestantes.jpg'],
);
execute(
  `INSERT OR IGNORE INTO content_items (content_id, title, body, category, image)
   VALUES (?, ?, ?, ?, ?)`,
  [2, 'Recursos de salud mental disponibles para ti', 'Información de bienestar', 'Bienestar', '/img/atencion-usuario.jpg'],
);
execute('UPDATE content_items SET image = ? WHERE content_id = ? AND (image IS NULL OR image = ?)',
  ['/img/madres-gestantes.jpg', 1, '']);
execute('UPDATE content_items SET image = ? WHERE content_id = ? AND (image IS NULL OR image = ?)',
  ['/img/atencion-usuario.jpg', 2, '']);
const additionalNews = [
  [3, 'Telemedicina: consulta desde donde estés', 'Conoce nuestras opciones de atención virtual.', 'Servicios', '/img/medicina-domiciliaria.jpg'],
  [4, 'Prevención y control de la hipertensión', 'Pequeños hábitos pueden proteger tu salud cardiovascular.', 'Prevención', '/img/medicamentos.jpg'],
  [5, 'Nuevos puntos de atención para afiliados', 'Encuentra servicios más cerca de tu hogar.', 'Novedades', '/img/puntos-atencion.jpg'],
];
for (const news of additionalNews) {
  execute(
    `INSERT OR IGNORE INTO content_items (content_id, title, body, category, image)
     VALUES (?, ?, ?, ?, ?)`,
    news,
  );
}

startService({
  name: 'content-service',
  port: 4003,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'content-service', status: 'ok' }),
    },
    {
      method: 'GET',
      path: '/news',
      handler: (_req, res) => {
        refreshDatabase();
        return json(res, 200, { items: queryRows(
          `SELECT content_id AS id, title, body, category AS tag, image, published_at AS publishedAt
           FROM content_items ORDER BY published_at DESC`,
        ) });
      },
    },
    {
      method: 'POST',
      path: '/news',
      handler: async (req, res) => {
        const data = await readJson(req);
        const title = String(data.title || '').trim();
        const body = String(data.body || '').trim();
        const category = String(data.category || 'General').trim();
        if (!title || !body) return json(res, 400, { error: 'Título y contenido son obligatorios' });
        const id = execute(
          `INSERT INTO content_items (title, body, category, image) VALUES (?, ?, ?, ?)`,
          [title, body, category, data.image || null],
        );
        return json(res, 201, { id, title, body, category });
      },
    },
    {
      method: 'PATCH',
      path: '/news',
      handler: async (req, res, url) => {
        const data = await readJson(req);
        const id = url.searchParams.get('id') || data.id;
        const current = queryOne('SELECT content_id FROM content_items WHERE content_id = ?', [id]);
        if (!current) return json(res, 404, { error: 'Contenido no encontrado' });
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
