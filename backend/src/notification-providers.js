const mode = process.env.NOTIFICATIONS_MODE || 'mock';

async function sendResend({ to, subject, body }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text: body }),
  });
  if (!response.ok) throw new Error(`Resend respondió ${response.status}`);
  return response.json();
}

async function sendTwilio({ channel, to, body }) {
  const account = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${account}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const form = new URLSearchParams({
    To: channel === 'whatsapp' ? `whatsapp:${to}` : to,
    From: channel === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_PHONE_NUMBER,
    Body: body,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!response.ok) throw new Error(`Twilio respondió ${response.status}`);
  return response.json();
}

export async function deliverNotification({ channel, to, subject, body }) {
  if (mode === 'mock') return { provider: 'mock', status: 'sent' };
  if (!to) throw new Error(`No hay destinatario para el canal ${channel}`);
  if (channel === 'email') return { provider: 'resend', ...(await sendResend({ to, subject, body })) };
  if (channel === 'sms' || channel === 'whatsapp') return { provider: 'twilio', ...(await sendTwilio({ channel, to, body })) };
  throw new Error(`Canal no soportado: ${channel}`);
}

export function getNotificationMode() {
  return mode;
}
