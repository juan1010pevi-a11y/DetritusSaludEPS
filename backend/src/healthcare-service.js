import { startService, json, readJson } from './service.js';
import { publishEvent } from './broker.js';
import { execute, initDatabase, queryOne, queryRows, refreshDatabase } from './database.js';

await initDatabase();

startService({
  name: 'healthcare-service',
  port: 4005,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'healthcare-service', status: 'ok' }),
    },
    {
      method: 'GET',
      path: '/appointments',
      handler: (req, res, url) => {
        refreshDatabase();
        const affiliateId = url.searchParams.get('affiliateId');
        const items = queryRows(
          `SELECT appointment_id AS id, affiliate_id AS affiliateId, specialty,
                  appointment_date AS date, status
           FROM fact_appointments
           ${affiliateId ? 'WHERE affiliate_id = ?' : ''}
           ORDER BY created_at DESC`,
          affiliateId ? [affiliateId] : [],
        );
        return json(res, 200, { items });
      },
    },
    {
      method: 'POST',
      path: '/appointments',
      handler: async (req, res) => {
        const data = await readJson(req);
        refreshDatabase();
        const affiliateDocument = String(data.document || data.affiliateId || '').trim();
        const affiliate = affiliateDocument
          ? queryOne('SELECT affiliate_id FROM dim_affiliates WHERE document = ?', [affiliateDocument])
          : null;
        const resolvedAffiliateId = affiliate?.affiliate_id || data.affiliateId || 'user-001';
        const id = `CITA-${Date.now()}`;
        const appointment = {
          id,
          affiliateId: resolvedAffiliateId,
          specialty: data.specialty || 'Medicina general',
          date: data.date || new Date().toISOString().slice(0, 10),
          status: 'requested',
        };
        execute(
          `INSERT OR IGNORE INTO dim_dates (date_key, date_value, year, month, day)
           VALUES (?, ?, ?, ?, ?)`,
          [appointment.date, appointment.date, Number(appointment.date.slice(0, 4)),
            Number(appointment.date.slice(5, 7)), Number(appointment.date.slice(8, 10))],
        );
        const service = queryOne('SELECT service_id FROM dim_services WHERE name = ?', [appointment.specialty]);
        execute(
          `INSERT INTO fact_appointments
             (appointment_id, affiliate_id, service_id, date_key, specialty, appointment_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, appointment.affiliateId, service?.service_id || null, appointment.date,
            appointment.specialty, appointment.date, appointment.status],
        );
        publishEvent('appointment.created', appointment);
        return json(res, 201, { appointment, event: 'appointment.created' });
      },
    },
    {
      method: 'PATCH',
      path: '/appointments',
      handler: async (req, res, url) => {
        const data = await readJson(req);
        refreshDatabase();
        const appointmentId = url.searchParams.get('id') || data.id;
        const allowedStatuses = ['requested', 'confirmed', 'completed', 'cancelled'];
        if (!appointmentId || !allowedStatuses.includes(data.status)) {
          return json(res, 400, { error: 'Cita y estado válido son obligatorios' });
        }
        const appointment = queryOne('SELECT appointment_id AS id, affiliate_id AS affiliateId FROM fact_appointments WHERE appointment_id = ?', [appointmentId]);
        if (!appointment) return json(res, 404, { error: 'Cita no encontrada' });
        execute('UPDATE fact_appointments SET status = ? WHERE appointment_id = ?', [data.status, appointmentId]);
        publishEvent('appointment.updated', { ...appointment, status: data.status });
        return json(res, 200, { appointment: { ...appointment, status: data.status }, event: 'appointment.updated' });
      },
    },
    {
      method: 'GET',
      path: '/authorizations',
      handler: (req, res, url) => {
        refreshDatabase();
        const value = url.searchParams.get('affiliateId') || url.searchParams.get('document');
        const affiliate = value
          ? queryOne('SELECT affiliate_id FROM dim_affiliates WHERE affiliate_id = ? OR document = ?', [value, value])
          : null;
        const affiliateId = affiliate?.affiliate_id || value;
        const items = queryRows(
          `SELECT authorization_id AS id, affiliate_id AS affiliateId,
                  service_id AS serviceId, status
           FROM fact_authorizations
           ${affiliateId ? 'WHERE affiliate_id = ?' : ''}`,
          affiliateId ? [affiliateId] : [],
        );
        return json(res, 200, { items });
      },
    },
    {
      method: 'POST',
      path: '/authorizations',
      handler: async (req, res) => {
        const data = await readJson(req);
        refreshDatabase();
        const affiliate = queryOne(
          'SELECT affiliate_id FROM dim_affiliates WHERE document = ? OR affiliate_id = ?',
          [data.document || data.affiliateId, data.document || data.affiliateId],
        );
        if (!affiliate || !data.serviceId) return json(res, 400, { error: 'Afiliado y servicio son obligatorios' });
        const authorization = {
          id: `AUTH-${Date.now()}`,
          affiliateId: affiliate.affiliate_id,
          serviceId: data.serviceId,
          status: 'requested',
        };
        execute(
          `INSERT INTO fact_authorizations (authorization_id, affiliate_id, service_id, status)
           VALUES (?, ?, ?, ?)`,
          [authorization.id, authorization.affiliateId, authorization.serviceId, authorization.status],
        );
        publishEvent('authorization.created', authorization);
        return json(res, 201, { authorization, event: 'authorization.created' });
      },
    },
  ],
});
