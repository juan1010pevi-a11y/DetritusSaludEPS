import { startService, json, readJson } from './service.js';
import { execute, initDatabase, queryOne, queryRows, refreshDatabase } from './database.js';
import { hashPassword } from './security.js';

await initDatabase();

startService({
  name: 'users-service',
  port: 4002,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'users-service', status: 'ok', database: 'sqlite' }),
    },
    {
      method: 'GET',
      path: '/affiliates/demo',
      handler: (_req, res) => {
        const affiliate = queryOne(
          `SELECT a.affiliate_id AS id, a.document, a.status, p.name AS plan
           FROM dim_affiliates a
           JOIN dim_plans p ON p.plan_id = a.plan_id
           WHERE a.affiliate_id = ?`,
          ['user-001'],
        );
        if (!affiliate) return json(res, 404, { error: 'Afiliado no encontrado' });
        return json(res, 200, affiliate);
      },
    },
    {
      method: 'GET',
      path: '/profile',
      handler: (req, res, url) => {
        refreshDatabase();
        const value = url.searchParams.get('affiliateId') || url.searchParams.get('document');
        const profile = queryOne(
          `SELECT a.affiliate_id AS id, a.name, a.document, a.role, a.status,
                  p.name AS plan, a.created_at AS createdAt
           FROM dim_affiliates a
           JOIN dim_plans p ON p.plan_id = a.plan_id
           WHERE a.affiliate_id = ? OR a.document = ?`,
          [value, value],
        );
        if (!profile) return json(res, 404, { error: 'Afiliado no encontrado' });
        return json(res, 200, profile);
      },
    },
    {
      method: 'PATCH',
      path: '/profile',
      handler: async (req, res) => {
        const data = await readJson(req);
        refreshDatabase();
        const profile = queryOne('SELECT affiliate_id FROM dim_affiliates WHERE affiliate_id = ?', [data.affiliateId]);
        if (!profile) return json(res, 404, { error: 'Afiliado no encontrado' });
        const name = String(data.name || '').trim();
        if (!name) return json(res, 400, { error: 'El nombre es obligatorio' });
        execute('UPDATE dim_affiliates SET name = ? WHERE affiliate_id = ?', [name, data.affiliateId]);
        return json(res, 200, { updated: true, id: data.affiliateId, name });
      },
    },
    {
      method: 'GET',
      path: '/staff/overview',
      handler: (_req, res) => {
        refreshDatabase();
        const counts = queryOne(`
          SELECT
            (SELECT COUNT(*) FROM dim_affiliates WHERE role = 'affiliate') AS affiliates,
            (SELECT COUNT(*) FROM fact_appointments WHERE status IN ('requested', 'confirmed')) AS activeAppointments,
            (SELECT COUNT(*) FROM fact_authorizations WHERE status IN ('requested', 'approved')) AS pendingAuthorizations,
            (SELECT COUNT(*) FROM fact_pqrs WHERE status NOT IN ('closed', 'answered')) AS openPqrs
        `);
        return json(res, 200, { items: counts });
      },
    },
    {
      method: 'POST',
      path: '/register',
      handler: async (req, res) => {
        const data = await readJson(req);
        const name = String(data.name || '').trim();
        const document = String(data.document || '').trim();
        const password = String(data.password || '');
        const planName = data.plan === 'subsidiado' ? 'Régimen subsidiado' : 'Régimen contributivo';
        const email = String(data.email || '').trim() || null;
        const phone = String(data.phone || '').trim() || null;

        if (!name || !document || password.length < 6) {
          return json(res, 400, { error: 'Nombre, documento y una contraseña de mínimo 6 caracteres son obligatorios' });
        }
        if (queryOne('SELECT affiliate_id FROM dim_affiliates WHERE document = ?', [document])) {
          return json(res, 409, { error: 'El documento ya está registrado' });
        }

        execute('INSERT OR IGNORE INTO dim_plans (name, regime) VALUES (?, ?)', [planName, data.plan || 'contributivo']);
        const plan = queryOne('SELECT plan_id FROM dim_plans WHERE name = ?', [planName]);
        const affiliateId = `user-${Date.now()}`;
        const hashedPassword = hashPassword(password);
        execute(
          `INSERT INTO dim_affiliates
             (affiliate_id, name, document, password, email, phone, role, status, plan_id)
           VALUES (?, ?, ?, ?, ?, ?, 'affiliate', 'active', ?)`,
          [affiliateId, name, document, hashedPassword, email, phone, plan.plan_id],
        );
        return json(res, 201, { id: affiliateId, name, document, status: 'active', plan: planName });
      },
    },
  ],
});
