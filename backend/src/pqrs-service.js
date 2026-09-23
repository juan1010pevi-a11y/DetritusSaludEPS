import { startService, json, readJson } from './service.js';
import { publishEvent } from './broker.js';
import { execute, initDatabase, queryOne, queryRows, refreshDatabase } from './database.js';

await initDatabase();

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
      handler: (req, res, url) => {
        refreshDatabase();
        const requestId = url.searchParams.get('id');
        const value = url.searchParams.get('affiliateId') || url.searchParams.get('document');
        const affiliate = value
          ? queryOne('SELECT affiliate_id FROM dim_affiliates WHERE affiliate_id = ? OR document = ?', [value, value])
          : null;
        const affiliateId = affiliate?.affiliate_id || value;
        const filters = [];
        const params = [];
        if (affiliateId) { filters.push('affiliate_id = ?'); params.push(affiliateId); }
        if (requestId) { filters.push('pqrs_id = ?'); params.push(requestId); }
        const items = queryRows(
          `SELECT pqrs_id AS id, affiliate_id AS affiliateId, type,
                  description, status, created_at AS createdAt
           FROM fact_pqrs
           ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
           ORDER BY created_at DESC`,
          params,
        );
        return json(res, 200, { items });
      },
    },
    {
      method: 'POST',
      path: '/requests',
      handler: async (req, res) => {
        const data = await readJson(req);
        refreshDatabase();
        if (!data.description) return json(res, 400, { error: 'La descripción es obligatoria' });
        const affiliateDocument = String(data.document || data.affiliateId || '').trim();
        const affiliate = affiliateDocument
          ? queryOne('SELECT affiliate_id FROM dim_affiliates WHERE document = ?', [affiliateDocument])
          : null;
        const resolvedAffiliateId = affiliate?.affiliate_id || data.affiliateId || 'user-001';
        const request = {
          id: `PQRS-${Date.now()}`,
          affiliateId: resolvedAffiliateId,
          type: data.type || 'petición',
          description: data.description,
          status: 'received',
          createdAt: new Date().toISOString(),
        };
        execute(
          `INSERT INTO fact_pqrs
             (pqrs_id, affiliate_id, type, description, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [request.id, request.affiliateId, request.type, request.description,
            request.status, request.createdAt],
        );
        publishEvent('pqrs.created', request);
        return json(res, 201, { request, event: 'pqrs.created' });
      },
    },
    {
      method: 'PATCH',
      path: '/requests',
      handler: async (req, res, url) => {
        const data = await readJson(req);
        refreshDatabase();
        const requestId = url.searchParams.get('id') || data.id;
        const allowedStatuses = ['received', 'in_review', 'answered', 'closed'];
        if (!requestId || !allowedStatuses.includes(data.status)) {
          return json(res, 400, { error: 'Solicitud y estado válido son obligatorios' });
        }
        const request = queryOne('SELECT pqrs_id AS id, affiliate_id AS affiliateId FROM fact_pqrs WHERE pqrs_id = ?', [requestId]);
        if (!request) return json(res, 404, { error: 'PQRS no encontrada' });
        execute('UPDATE fact_pqrs SET status = ? WHERE pqrs_id = ?', [data.status, requestId]);
        publishEvent('pqrs.updated', { ...request, status: data.status });
        return json(res, 200, { request: { ...request, status: data.status }, event: 'pqrs.updated' });
      },
    },
  ],
});
