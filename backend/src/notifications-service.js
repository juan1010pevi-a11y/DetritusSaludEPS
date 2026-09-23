import { startService, json, readJson } from './service.js';
import { consumeEvents, getBrokerStatus } from './broker.js';
import { execute, initDatabase, queryOne, queryRows, refreshDatabase } from './database.js';
import { deliverNotification, getNotificationMode } from './notification-providers.js';

await initDatabase();

async function processNotification(event) {
  const payload = event.payload || {};
  refreshDatabase();
  const affiliate = payload.affiliateId
    ? queryOne('SELECT email, phone FROM dim_affiliates WHERE affiliate_id = ?', [payload.affiliateId])
    : null;
  const channel = payload.channel || process.env.NOTIFICATIONS_CHANNEL || 'email';
  const notificationId = event.notificationId || `NOT-${Date.now()}`;
  const subject = `Actualización de salud: ${event.type}`;
  const body = `Se registró el evento ${event.type}. Identificador: ${payload.id || 'sin identificador'}.`;
  execute(
    `INSERT INTO fact_notifications
       (notification_id, affiliate_id, event_type, channel, status, payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [notificationId, payload.affiliateId || null, event.type, channel, 'queued', JSON.stringify(payload)],
  );
  try {
    const recipient = channel === 'email' ? affiliate?.email : affiliate?.phone;
    const result = await deliverNotification({ channel, to: recipient, subject, body });
    execute('UPDATE fact_notifications SET status = ?, payload = ? WHERE notification_id = ?',
      ['sent', JSON.stringify({ ...payload, delivery: result }), notificationId]);
    console.log(`Notificación enviada en modo ${getNotificationMode()} para ${event.type}`);
  } catch (error) {
    execute('UPDATE fact_notifications SET status = ?, payload = ? WHERE notification_id = ?',
      ['failed', JSON.stringify({ ...payload, error: error.message }), notificationId]);
    console.warn(`Notificación fallida para ${event.type}: ${error.message}`);
  }
}

consumeEvents(processNotification);

startService({
  name: 'notifications-service',
  port: 4004,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'notifications-service', status: 'ok', mode: getNotificationMode(), rabbitmq: getBrokerStatus() }),
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
        const notification = { id: `NOT-${Date.now()}`, channel: data.channel || 'email', status: 'queued' };
        processNotification({ notificationId: notification.id, type: data.eventType || 'notification.manual', payload: { ...data, id: notification.id } });
        return json(res, 202, { accepted: true, notification, mode: getNotificationMode() });
      },
    },
    {
      method: 'GET',
      path: '/notifications',
      handler: (_req, res, url) => {
        refreshDatabase();
        const affiliateId = url.searchParams.get('affiliateId');
        return json(res, 200, { items: queryRows(
          `SELECT notification_id AS id, affiliate_id AS affiliateId,
                  event_type AS eventType, channel, status, payload, created_at AS createdAt
           FROM fact_notifications
           ${affiliateId ? 'WHERE affiliate_id = ?' : ''}
           ORDER BY created_at DESC`,
          affiliateId ? [affiliateId] : [],
        ) });
      },
    },
  ],
});
