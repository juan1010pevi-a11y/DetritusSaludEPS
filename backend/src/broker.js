import amqp from 'amqplib';

const url = process.env.RABBITMQ_URL || 'amqp://detritus:detritus@localhost:5672';
const exchange = 'detritus.events';
let status = 'disconnected';

export function getBrokerStatus() {
  return { status, exchange, url: url.replace(/:[^:@]+@/, ':***@') };
}

export async function publishEvent(type, payload) {
  try {
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    channel.publish(exchange, type, Buffer.from(JSON.stringify({ type, payload, createdAt: new Date().toISOString() })), { persistent: true });
    status = 'connected';
    setTimeout(() => connection.close(), 100);
    console.log(`Evento publicado: ${type}`);
  } catch (error) {
    console.warn(`RabbitMQ no disponible; evento ${type} no publicado: ${error.message}`);
  }
}

export async function consumeEvents(handler) {
  try {
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    const queue = await channel.assertQueue('notifications.queue', { durable: true });
    await channel.bindQueue(queue.queue, exchange, '#');
    status = 'connected';
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
    console.warn(`RabbitMQ no disponible; Notifications Service continuará en modo local: ${error.message}`);
    setTimeout(() => consumeEvents(handler), 5000);
  }
}
