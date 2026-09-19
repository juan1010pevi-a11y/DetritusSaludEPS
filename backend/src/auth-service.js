import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startService, json, readJson } from './service.js';

const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'users.json');
const users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const tokenSecret = process.env.AUTH_SECRET || 'detritus-academic-secret';

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

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
        const { document, password } = await readJson(req);
        const user = users.find(item => item.document === document && item.password === password && item.status === 'active');
        if (!user) return json(res, 401, { service: 'auth-service', error: 'Documento o contraseña incorrectos' });
        return json(res, 200, {
          token: signToken(user),
          user: { id: user.id, name: user.name, role: user.role },
        });
      },
    },
  ],
});
