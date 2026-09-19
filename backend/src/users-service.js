import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startService, json } from './service.js';

const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'users.json');
const users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

startService({
  name: 'users-service',
  port: 4002,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'users-service', status: 'ok' }),
    },
    {
      method: 'GET',
      path: '/affiliates/demo',
      handler: (_req, res) => {
        const user = users[0];
        return json(res, 200, {
          id: user.id,
          document: user.document,
          status: user.status,
          plan: user.plan,
        });
      },
    },
  ],
});
