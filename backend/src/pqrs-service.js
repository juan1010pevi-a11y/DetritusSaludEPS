import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startService, json, readJson } from './service.js';
import { publishEvent } from './broker.js';

const requestsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'pqrs.json');
const requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));

startService({
  name: 'pqrs-service',
  port: 4006,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'pqrs-service', status: 'ok' }),
    },
    {
      method: 'GET',
      path: '/requests',
      handler: (_req, res) => json(res, 200, { items: requests }),
    },
    {
      method: 'POST',
      path: '/requests',
      handler: async (req, res) => {
        const data = await readJson(req);
        if (!data.description) return json(res, 400, { error: 'La descripción es obligatoria' });
        const request = {
          id: `PQRS-${String(requests.length + 1).padStart(3, '0')}`,
          affiliateId: data.affiliateId || 'user-001',
          type: data.type || 'petición',
          description: data.description,
          status: 'received',
          createdAt: new Date().toISOString(),
        };
        requests.push(request);
        fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
        publishEvent('pqrs.created', request);
        return json(res, 201, { request, event: 'pqrs.created' });
      },
    },
  ],
});
