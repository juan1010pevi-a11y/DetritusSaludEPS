import crypto from 'node:crypto';
import { startService, json, readJson } from './service.js';
import { consumeEvents, getBrokerStatus } from './broker.js';
import { createDatabase } from './database.js';
import { configuredChannels, deliverNotification, getNotificationMode } from './notification-providers.js';
import { renderNotification } from './notification-templates.js';
import { requireRole } from './auth.js';
import { peopleById, requireInternal, resolvePerson } from './internal.js';
import { maskContact, normalizePhone } from './validators.js';

const db = await createDatabase('notifications');
const { queryRows, execute } = db;

/**
 * ¿A quién y por qué canales? Si el evento trae un contacto (p. ej. una PQRS de alguien
 * que no es afiliado) se usa ese; si no, se consultan los datos del afiliado en users-service.
 */
async function recipientFor(payload) {
  if (payload.contact?.email || payload.contact?.phone) {
    return { id: payload.affiliateId || null, name: payload.contact.name, email: payload.contact.email, phone: payload.contact.phone, whatsappOptIn: payload.contact.whatsapp !== false };
  }
  if (!payload.affiliateId) return null;
  return (await peopleById([payload.affiliateId])).get(payload.affiliateId) || null;
}

function channelsFor(person) {
  const channels = [];
  if (person.email) channels.push(['email', person.email]);
  const phone = normalizePhone(person.phone);
  if (phone) channels.push(['sms', phone]);
  if (phone && person.whatsappOptIn) channels.push(['whatsapp', phone]);
  return channels;
}

export async function processEvent(event) {
  const payload = event.payload || {};
  const person = await recipientFor(payload);
  const message = renderNotification(event.type, payload, person?.name);
  if (!message || !person) return { delivered: 0 };
  const eventId = event.eventId || crypto.randomUUID();
  const results = [];
  for (const [channel, recipient] of channelsFor(person)) {
    const id = `NOT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const text = channel === 'email' ? message.body : message.short;
    // Un código de verificación se envía, pero NUNCA se guarda en la base de datos.
    const stored = message.secret ? text.replaceAll(message.secret, '••••••') : text;
    execute(
      `INSERT INTO fact_notifications (notification_id, event_id, affiliate_id, event_type, channel, recipient, subject, body, status, reference, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
      [id, eventId, person.id || null, event.type, channel, recipient, message.subject, stored, message.reference || null, new Date().toISOString()],
    );
    try {
      const result = await deliverNotification({ channel, to: recipient, subject: message.subject, body: text });
      execute('UPDATE fact_notifications SET status = ?, provider = ?, error = ?, sent_at = ? WHERE notification_id = ?',
        [result.status, result.provider, result.status === 'skipped' ? result.reference : null, new Date().toISOString(), id]);
      results.push({ channel, status: result.status });
    } catch (error) {
      execute('UPDATE fact_notifications SET status = ?, error = ? WHERE notification_id = ?', ['failed', error.message, id]);
      console.warn(`Notificación ${channel} fallida para ${event.type}: ${error.message}`);
      results.push({ channel, status: 'failed' });
    }
  }
  console.log(`Evento ${event.type}: ${results.map(r => `${r.channel}=${r.status}`).join(', ') || 'sin canales'} (modo ${getNotificationMode()})`);
  return { delivered: results.length, results };
}

consumeEvents(processEvent);

const LIST_COLUMNS = `notification_id AS id, event_id AS eventId, affiliate_id AS affiliateId, event_type AS eventType, channel,
  recipient, subject, body, status, provider, error, reference, created_at AS createdAt`;

const present = row => ({ ...row, recipient: maskContact(row.recipient) });

startService({
  name: 'notifications-service',
  serviceKey: 'notifications',
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, {
        service: 'notifications-service', status: 'ok', database: db.file,
        mode: getNotificationMode(), channels: configuredChannels(), rabbitmq: getBrokerStatus(),
      }),
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
      // Respaldo de RabbitMQ: los demás microservicios entregan aquí los eventos por HTTP.
      method: 'POST',
      path: '/internal/events',
      handler: async (req, res) => {
        if (!requireInternal(req, res)) return;
        const event = await readJson(req);
        if (!event.type) return json(res, 400, { error: 'El evento necesita un tipo.' });
        const result = await processEvent(event);
        return json(res, 202, { accepted: true, ...result });
      },
    },
    {
      // Bandeja del usuario: lo que se le envió por correo, SMS y WhatsApp.
      method: 'GET',
      path: '/notifications/mine',
      handler: (req, res) => {
        const user = requireRole(req, res);
        if (!user) return;
        const items = queryRows(`SELECT ${LIST_COLUMNS} FROM fact_notifications WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 100`, [user.sub]);
        return json(res, 200, { items: items.map(present), mode: getNotificationMode() });
      },
    },
    {
      method: 'GET',
      path: '/notifications',
      handler: (req, res, url) => {
        if (!requireRole(req, res, ['administrator'])) return;
        const affiliateId = url.searchParams.get('affiliateId');
        const items = queryRows(
          `SELECT ${LIST_COLUMNS} FROM fact_notifications ${affiliateId ? 'WHERE affiliate_id = ?' : ''} ORDER BY created_at DESC LIMIT 200`,
          affiliateId ? [affiliateId] : [],
        );
        return json(res, 200, { items: items.map(present), mode: getNotificationMode() });
      },
    },
    {
      // Mensaje manual del administrador a un afiliado (documento o id).
      method: 'POST',
      path: '/notifications',
      handler: async (req, res) => {
        const admin = requireRole(req, res, ['administrator']);
        if (!admin) return;
        const data = await readJson(req);
        const person = await resolvePerson(data.document || data.affiliateId);
        const subject = String(data.subject || '').trim();
        const message = String(data.message || '').trim();
        if (!person) return json(res, 404, { error: 'No existe un usuario con ese documento.' });
        if (subject.length < 3 || message.length < 5) return json(res, 400, { error: 'Escribe el asunto y el mensaje.' });
        const result = await processEvent({ type: 'manual', payload: { affiliateId: person.id, subject, message } });
        return json(res, 202, { accepted: true, ...result });
      },
    },
  ],
});
