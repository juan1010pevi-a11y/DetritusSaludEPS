import crypto from 'node:crypto';
import { startService, json, readJson } from './service.js';
import { initDatabase, queryOne, refreshDatabase } from './database.js';
import { verifyPassword } from './security.js';

const tokenSecret = process.env.AUTH_SECRET || 'detritus-academic-secret';

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

await initDatabase();

startService({
  name: 'auth-service',
  port: 4001,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'auth-service', status: 'ok' }),
    },
    {
      method: 'POST',
      path: '/login',
      handler: async (req, res) => {
        const { document, password, role } = await readJson(req);
        refreshDatabase();
        const user = queryOne(
          `SELECT a.affiliate_id AS id, a.name, ur.role, a.password, a.status
           FROM dim_affiliates a
           JOIN user_roles ur ON ur.user_id = a.affiliate_id
           WHERE a.document = ? AND (? IS NULL OR ur.role = ?)`,
          [document, role || null, role || null],
        );
        if (!user || !verifyPassword(password, user.password) || user.status !== 'active') {
          return json(res, 401, { service: 'auth-service', error: 'Documento o contraseña incorrectos' });
        }
        return json(res, 200, {
          token: signToken(user),
          user: { id: user.id, name: user.name, role: user.role },
        });
      },
    },
  ],
});
