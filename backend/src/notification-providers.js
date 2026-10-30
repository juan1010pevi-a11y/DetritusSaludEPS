import { sendSmtpMail } from './smtp-client.js';

/**
 * Proveedores reales de envío (credenciales en backend/.env, ver backend/.env.example):
 *   - Correo: SMTP (por ejemplo Gmail con contraseña de aplicación) o Resend.
 *   - SMS y WhatsApp: Twilio.
 *
 * Modo de envío (NOTIFICATIONS_MODE):
 *   - live → se envía de verdad por los canales con credenciales.
 *   - mock → no sale nada a internet; queda como "simulado" en la bandeja del portal.
 *   - Si no se define, se usa "live" cuando hay al menos un canal con credenciales
 *     reales y "mock" cuando no hay ninguno.
 */
const env = name => String(process.env[name] || '').trim();

// Valores de ejemplo de .env.example: si siguen ahí, el canal NO está configurado.
const PLACEHOLDER = /tu\.correo|x{4}|X{4}|^change-this|^<|>$/;
const real = name => {
  const value = env(name);
  return value && !PLACEHOLDER.test(value) ? value : '';
};

/** Indica qué canales tienen credenciales configuradas (y no son los valores de ejemplo). */
export function configuredChannels() {
  const smtp = Boolean(real('SMTP_HOST') && real('SMTP_USER') && real('SMTP_PASS'));
  const twilio = Boolean(real('TWILIO_ACCOUNT_SID') && real('TWILIO_AUTH_TOKEN'));
  return {
    email: smtp || Boolean(real('RESEND_API_KEY')),
    sms: twilio && Boolean(real('TWILIO_PHONE_NUMBER')),
    whatsapp: twilio && Boolean(real('TWILIO_WHATSAPP_FROM')),
  };
}

export function getNotificationMode() {
  const explicit = env('NOTIFICATIONS_MODE').toLowerCase();
  if (explicit === 'live' || explicit === 'mock') return explicit;
  return Object.values(configuredChannels()).some(Boolean) ? 'live' : 'mock';
}

/** Explica qué falta para que cada canal funcione (se muestra en /health y al arrancar). */
export function channelProblems() {
  const problems = [];
  const channels = configuredChannels();
  if (!channels.email) problems.push('Correo: faltan SMTP_HOST, SMTP_USER y SMTP_PASS (contraseña de aplicación de Gmail) o RESEND_API_KEY.');
  if (!channels.whatsapp) problems.push('WhatsApp: faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM.');
  if (!channels.sms) problems.push('SMS: faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_PHONE_NUMBER.');
  return problems;
}

async function sendEmail({ to, subject, body }) {
  if (real('SMTP_HOST') && real('SMTP_USER') && real('SMTP_PASS')) {
    const user = real('SMTP_USER');
    try {
      await sendSmtpMail({
        host: real('SMTP_HOST'), port: Number(env('SMTP_PORT') || 465),
        // Gmail muestra la contraseña de aplicación como "abcd efgh ijkl mnop": los espacios sobran.
        user, pass: real('SMTP_PASS').replace(/\s+/g, ''),
        // Gmail solo deja enviar "desde" la misma cuenta con la que se inicia sesión.
        from: real('MAIL_FROM') || user, to, subject, text: body,
      });
    } catch (error) {
      if (/\b535\b|534|Username and Password not accepted|BadCredentials/i.test(error.message)) {
        throw new Error('Gmail rechazó el usuario o la contraseña. Usa una "contraseña de aplicación" (https://myaccount.google.com/apppasswords), no la contraseña normal de la cuenta.');
      }
      throw error;
    }
    return { provider: 'smtp', reference: null };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${real('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: real('MAIL_FROM') || 'Detritus Salud <onboarding@resend.dev>', to: [to], subject, text: body }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend respondió ${response.status}: ${data.message || 'sin detalle'}`);
  return { provider: 'resend', reference: data.id };
}

/** Twilio necesita el número en formato internacional: +573001234567. */
export function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  return digits ? `+${digits}` : '';
}

/** Acepta "whatsapp:+14155238886", "+14155238886" o "14155238886". */
export function whatsappAddress(number) {
  const text = String(number || '').trim();
  return `whatsapp:${toE164(text.replace(/^whatsapp:/i, ''))}`;
}

// Errores frecuentes de Twilio explicados en español.
const TWILIO_HINTS = {
  21211: 'El número de destino no es válido.',
  21408: 'Tu cuenta de Twilio no tiene permiso para enviar SMS a Colombia (actívalo en Messaging → Settings → Geo permissions).',
  21608: 'La cuenta de prueba de Twilio solo envía a números verificados: agrega este celular en Phone Numbers → Verified Caller IDs.',
  21606: 'El número TWILIO_PHONE_NUMBER no puede enviar SMS: usa el número que te asignó Twilio.',
  63007: 'TWILIO_WHATSAPP_FROM no es un remitente de WhatsApp válido. Para el sandbox usa whatsapp:+14155238886.',
  63015: 'Este celular no se ha unido al sandbox de WhatsApp: desde ese WhatsApp envía "join <código>" al +1 415 523 8886.',
  63016: 'Pasaron más de 24 h desde el último mensaje del usuario al sandbox: escríbele de nuevo cualquier mensaje al +1 415 523 8886.',
  20003: 'TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN son incorrectos.',
};

async function sendTwilio({ channel, to, body }) {
  const account = real('TWILIO_ACCOUNT_SID');
  const auth = Buffer.from(`${account}:${real('TWILIO_AUTH_TOKEN')}`).toString('base64');
  const form = new URLSearchParams({
    To: channel === 'whatsapp' ? whatsappAddress(to) : toE164(to),
    From: channel === 'whatsapp' ? whatsappAddress(real('TWILIO_WHATSAPP_FROM')) : toE164(real('TWILIO_PHONE_NUMBER')),
    Body: body,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(TWILIO_HINTS[data.code] || `Twilio respondió ${response.status}${data.code ? ` (código ${data.code})` : ''}: ${data.message || 'sin detalle'}`);
  }
  return { provider: 'twilio', reference: data.sid };
}

/**
 * Entrega un mensaje por un canal. Devuelve { status, provider, reference }:
 *   simulated → modo demostración · sent → enviado · skipped → canal sin credenciales.
 */
export async function deliverNotification({ channel, to, subject, body }) {
  if (!to) throw new Error(`No hay destinatario para el canal ${channel}`);
  if (getNotificationMode() !== 'live') return { status: 'simulated', provider: 'mock' };
  if (!configuredChannels()[channel]) return { status: 'skipped', provider: null, reference: `Canal ${channel} sin credenciales configuradas` };
  if (channel === 'email') return { status: 'sent', ...(await sendEmail({ to, subject, body })) };
  if (channel === 'sms' || channel === 'whatsapp') return { status: 'sent', ...(await sendTwilio({ channel, to, body })) };
  throw new Error(`Canal no soportado: ${channel}`);
}
