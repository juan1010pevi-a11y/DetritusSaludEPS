import { startService, json, readJson } from './service.js';
import { consumeEvents, getBrokerStatus } from './broker.js';

const notifications = [];

consumeEvents(event => {
  notifications.push({ event, status: 'queued' });
  console.log(`Notificación encolada para ${event.type}`);
});

startService({
  name: 'notifications-service',
  port: 4004,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'notifications-service', status: 'ok', rabbitmq: getBrokerStatus() }),
    },
    {
      method: 'GET',
      path: '/health/rabbitmq',
      handler: (_req, res) => {
        const broker = getBrokerStatus();
        return json(res, broker.status === 'connected' ? 200 : 503, { service: 'notifications-service', rabbitmq: broker });
      },
    },
    {
      method: 'POST',
      path: '/notifications',
      handler: async (req, res) => {
        const data = await readJson(req);
        const notification = { id: `NOT-${notifications.length + 1}`, channel: data.channel || 'email', status: 'queued' };
        notifications.push(notification);
        return json(res, 202, { accepted: true, notification });
      },
    },
    {
      method: 'GET',
      path: '/notifications',
      handler: (_req, res) => json(res, 200, { items: notifications }),
    },
  ],
});
