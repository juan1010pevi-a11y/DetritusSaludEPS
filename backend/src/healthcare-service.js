import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startService, json, readJson } from './service.js';
import { publishEvent } from './broker.js';

const appointmentsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'appointments.json');
const appointments = JSON.parse(fs.readFileSync(appointmentsPath, 'utf8'));
const authorizations = [
  { id: 'AUTH-001', affiliateId: 'user-001', service: 'Consulta medicina general', status: 'approved' },
];

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
      handler: (_req, res) => json(res, 200, { items: appointments }),
    },
    {
      method: 'POST',
      path: '/appointments',
      handler: async (req, res) => {
        const data = await readJson(req);
        const appointment = {
          id: `CITA-${String(appointments.length + 1).padStart(3, '0')}`,
          affiliateId: data.affiliateId || 'user-001',
          specialty: data.specialty || 'Medicina general',
          date: data.date || new Date().toISOString().slice(0, 10),
          status: 'requested',
        };
        appointments.push(appointment);
        fs.writeFileSync(appointmentsPath, JSON.stringify(appointments, null, 2));
        publishEvent('appointment.created', appointment);
        return json(res, 201, { appointment, event: 'appointment.created' });
      },
    },
    {
      method: 'GET',
      path: '/authorizations',
      handler: (_req, res) => json(res, 200, { items: authorizations }),
    },
  ],
});
