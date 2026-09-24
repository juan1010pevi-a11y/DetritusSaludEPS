import crypto from 'node:crypto';
import { startService, json, readJson } from './service.js';
import { execute, initDatabase, queryOne, queryRows, refreshDatabase } from './database.js';
import { hashPassword } from './security.js';

const tokenSecret = process.env.AUTH_SECRET || 'detritus-academic-secret';
const availableRoles = ['affiliate', 'doctor', 'administrator'];

function getAuthenticatedUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  if (signature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return user.exp > Date.now() ? user : null;
  } catch {
    return null;
  }
}

function requireAdministrator(req, res) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'administrator') {
    json(res, 403, { error: 'Se requiere un perfil administrador' });
    return null;
  }
  return user;
}

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
          `SELECT a.affiliate_id AS id, a.name, a.document,
                  COALESCE(GROUP_CONCAT(ur.role), a.role) AS roles,
                  a.role, a.status,
                  p.name AS plan, a.created_at AS createdAt
           FROM dim_affiliates a
           JOIN dim_plans p ON p.plan_id = a.plan_id
           LEFT JOIN user_roles ur ON ur.user_id = a.affiliate_id
           WHERE a.affiliate_id = ? OR a.document = ?
           GROUP BY a.affiliate_id`,
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
            (SELECT COUNT(*) FROM user_roles WHERE role = 'affiliate') AS affiliates,
            (SELECT COUNT(*) FROM fact_appointments WHERE status IN ('requested', 'confirmed')) AS activeAppointments,
            (SELECT COUNT(*) FROM fact_authorizations WHERE status IN ('requested', 'approved')) AS pendingAuthorizations,
            (SELECT COUNT(*) FROM fact_pqrs WHERE status NOT IN ('closed', 'answered')) AS openPqrs
        `);
        return json(res, 200, { items: counts });
      },
    },
    {
      method: 'GET',
      path: '/staff/users',
      handler: (req, res) => {
        if (!requireAdministrator(req, res)) return;
        refreshDatabase();
        const users = queryRows(`
          SELECT a.affiliate_id AS id, a.name, a.document, a.email, a.status,
                 COALESCE(GROUP_CONCAT(ur.role), a.role) AS roles
          FROM dim_affiliates a
          LEFT JOIN user_roles ur ON ur.user_id = a.affiliate_id
          GROUP BY a.affiliate_id
          ORDER BY a.name COLLATE NOCASE
        `).map(user => ({ ...user, roles: user.roles ? user.roles.split(',') : [] }));
        return json(res, 200, { items: users, availableRoles });
      },
    },
    {
      method: 'PUT',
      path: '/staff/roles',
      handler: async (req, res) => {
        if (!requireAdministrator(req, res)) return;
        const data = await readJson(req);
        const userId = String(data.userId || '').trim();
        const roles = [...new Set(Array.isArray(data.roles) ? data.roles : [])];
        if (!userId || !roles.length || roles.some(role => !availableRoles.includes(role))) {
          return json(res, 400, { error: 'Usuario y al menos un rol válido son obligatorios' });
        }
        refreshDatabase();
        const user = queryOne('SELECT affiliate_id FROM dim_affiliates WHERE affiliate_id = ?', [userId]);
        if (!user) return json(res, 404, { error: 'Usuario no encontrado' });
        execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
        roles.forEach(role => execute('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [userId, role]));
        execute('UPDATE dim_affiliates SET role = ? WHERE affiliate_id = ?', [roles[0], userId]);
        return json(res, 200, { updated: true, userId, roles });
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
        execute('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [affiliateId, 'affiliate']);
        return json(res, 201, { id: affiliateId, name, document, status: 'active', plan: planName });
      },
    },
  ],
});
