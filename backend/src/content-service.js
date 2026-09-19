import { startService, json } from './service.js';

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
      handler: (_req, res) => json(res, 200, { items: [
        { title: 'Jornada de vacunación contra la influenza 2026', tag: 'Campaña' },
        { title: 'Recursos de salud mental disponibles para ti', tag: 'Bienestar' },
      ] }),
    },
  ],
});
