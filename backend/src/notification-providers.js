import { sendSmtpMail } from './smtp-client.js';

/**
 * Proveedores reales de envío. Se activan con NOTIFICATIONS_MODE=live y las
 * credenciales de cada canal (ver backend/.env.example):
 *   - Correo: SMTP (por ejemplo Gmail con contraseña de aplicación) o Resend.
 *   - SMS y WhatsApp: Twilio.
 * Con NOTIFICATIONS_MODE=mock (valor por defecto) no sale nada a internet: el mensaje
 * queda registrado como "simulado" en la bandeja de notificaciones del afiliado.
 */
const mode = () => (process.env.NOTIFICATIONS_MODE || 'mock').toLowerCase();

export function getNotificationMode() {
  return mode();
}

/** Indica qué canales tienen credenciales configuradas. */
export function configuredChannels() {
  return {
    email: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
    whatsapp: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM),
  };
}

async function sendEmail({ to, subject, body }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (process.env.SMTP_HOST) {
    await sendSmtpMail({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
      user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from, to, subject, text: body,
    });
    return { provider: 'smtp', reference: null };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text: body }),
  });
  if (!response.ok) throw new Error(`Resend respondió ${response.status}`);
  const data = await response.json();
  return { provider: 'resend', reference: data.id };
}

/** Twilio necesita el número en formato internacional: +573001234567. */
export function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  return digits ? `+${digits}` : '';
}

async function sendTwilio({ channel, to, body }) {
  const account = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${account}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const form = new URLSearchParams({
    To: channel === 'whatsapp' ? `whatsapp:${toE164(to)}` : toE164(to),
    From: channel === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_PHONE_NUMBER,
    Body: body,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!response.ok) throw new Error(`Twilio respondió ${response.status}`);
  const data = await response.json();
  return { provider: 'twilio', reference: data.sid };
}

/**
 * Entrega un mensaje por un canal. Devuelve { status, provider, reference }:
 *   simulated → modo demostración · sent → enviado · skipped → canal sin credenciales.
 */
export async function deliverNotification({ channel, to, subject, body }) {
  if (!to) throw new Error(`No hay destinatario para el canal ${channel}`);
  if (mode() !== 'live') return { status: 'simulated', provider: 'mock' };
  if (!configuredChannels()[channel]) return { status: 'skipped', provider: null, reference: `Canal ${channel} sin credenciales configuradas` };
  if (channel === 'email') return { status: 'sent', ...(await sendEmail({ to, subject, body })) };
  if (channel === 'sms' || channel === 'whatsapp') return { status: 'sent', ...(await sendTwilio({ channel, to, body })) };
  throw new Error(`Canal no soportado: ${channel}`);
}
