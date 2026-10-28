import { callService } from './internal.js';

/**
 * Bus de eventos. Si RabbitMQ está disponible (docker compose) los eventos viajan por
 * el exchange `detritus.events` y Notifications Service los consume de su cola.
 * Si RabbitMQ no está corriendo (desarrollo con npm start, pruebas automáticas), el
 * evento se entrega directamente por HTTP a Notifications Service, así ningún aviso
 * por correo, SMS o WhatsApp se pierde.
 */
const url = process.env.RABBITMQ_URL || 'amqp://detritus:detritus@localhost:5672';
const disabled = process.env.RABBITMQ_DISABLED === '1';
const exchange = 'detritus.events';
let status = disabled ? 'disabled' : 'disconnected';
let channelPromise = null;
let warned = false;

// amqplib se carga solo cuando se necesita: las pruebas automáticas corren sin RabbitMQ.
async function amqp() {
  return (await import('amqplib')).default;
}

export function getBrokerStatus() {
  return { status, exchange, url: url.replace(/:[^:@]+@/, ':***@') };
}

async function getChannel() {
  if (disabled) throw new Error('RabbitMQ deshabilitado');
  channelPromise ||= (async () => {
    const connection = await (await amqp()).connect(url, { timeout: 2000 });
    connection.on('close', () => { channelPromise = null; status = 'disconnected'; });
    connection.on('error', () => { channelPromise = null; status = 'disconnected'; });
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    // La cola se declara también al publicar, para no perder eventos si Notifications arranca después.
    const queue = await channel.assertQueue('notifications.queue', { durable: true });
    await channel.bindQueue(queue.queue, exchange, '#');
    status = 'connected';
    return channel;
  })().catch(error => { channelPromise = null; throw error; });
  return channelPromise;
}

export async function publishEvent(type, payload) {
  const event = { type, payload, createdAt: new Date().toISOString() };
  try {
    const channel = await getChannel();
    channel.publish(exchange, type, Buffer.from(JSON.stringify(event)), { persistent: true });
    return { via: 'rabbitmq' };
  } catch (error) {
    if (!warned && !disabled) {
      console.warn(`RabbitMQ no disponible (${error.message}); los eventos se envían por HTTP a Notifications Service.`);
      warned = true;
    }
  }
  try {
    await callService('notifications', '/internal/events', { method: 'POST', body: event });
    return { via: 'http' };
  } catch (error) {
    console.warn(`No se pudo entregar el evento ${type}: ${error.message}`);
    return { via: 'none' };
  }
}

export async function consumeEvents(handler) {
  if (disabled) return;
  try {
    const connection = await (await amqp()).connect(url, { timeout: 2000 });
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    const queue = await channel.assertQueue('notifications.queue', { durable: true });
    await channel.bindQueue(queue.queue, exchange, '#');
    status = 'connected';
    connection.on('close', () => { status = 'disconnected'; setTimeout(() => consumeEvents(handler), 5000); });
    channel.consume(queue.queue, message => {
      if (!message) return;
      Promise.resolve(handler(JSON.parse(message.content.toString())))
        .then(() => channel.ack(message))
        .catch(error => {
          console.warn(`No se pudo procesar el evento: ${error.message}`);
          channel.nack(message, false, false);
        });
    });
    console.log('Notifications Service conectado a RabbitMQ');
  } catch (error) {
    status = 'disconnected';
    if (!warned) {
      console.warn(`RabbitMQ no disponible; Notifications Service recibirá los eventos por HTTP: ${error.message}`);
      warned = true;
    }
    setTimeout(() => consumeEvents(handler), 15000).unref();
  }
}
