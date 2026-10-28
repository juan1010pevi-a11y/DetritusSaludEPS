import { useEffect, useMemo, useState } from 'react';
import { getAllNotifications, getMyNotifications } from '../../services/api';
import { formatDateTime } from '../../lib/roles';

const CHANNELS = { email: 'Correo', sms: 'SMS', whatsapp: 'WhatsApp' };
const STATUS = {
  sent: 'Enviado',
  simulated: 'Simulado (modo demo)',
  failed: 'Falló',
  skipped: 'Canal sin configurar',
  queued: 'En cola',
};

function ChannelIcon({ channel }) {
  const paths = {
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    sms: <><path d="M4 5h16v11H8l-4 4z" /><path d="M8 10h8M8 13h5" /></>,
    whatsapp: <><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z" /><path d="M9 9.5c.5 2 2 3.5 4 4l1-1 2 1c-.4 1.2-1.5 1.8-2.6 1.5A7 7 0 0 1 8 10.4C7.8 9.3 8.3 8.2 9.5 8l1 2z" /></>,
  };
  return <svg className="notification-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[channel]}</svg>;
}

/**
 * Bandeja de lo que la EPS le envió al usuario por correo, SMS y WhatsApp.
 * Con `adminMode` muestra todo lo enviado (incluye PQRS de personas no afiliadas).
 */
export default function NotificationsPanel({ adminMode = false }) {
  const [data, setData] = useState({ items: [], mode: 'mock' });
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (adminMode ? getAllNotifications() : getMyNotifications()).then(setData).catch(err => setError(err.message));
  }, [adminMode]);

  // Un evento genera un mensaje por canal: se agrupan para mostrarlos juntos.
  const events = useMemo(() => {
    const groups = new Map();
    data.items.forEach(item => {
      const group = groups.get(item.eventId) || { ...item, channels: [] };
      group.channels.push(item);
      if (item.channel === 'email') Object.assign(group, { subject: item.subject, body: item.body });
      groups.set(item.eventId, group);
    });
    return [...groups.values()];
  }, [data.items]);

  return (
    <section className="portal-card">
      <div className="portal-card__head">
        <div>
          <span className="portal-label">{adminMode ? 'Bandeja de salida' : 'Mis notificaciones'}</span>
          <h3>{adminMode ? 'Mensajes enviados por la EPS' : 'Correos, SMS y WhatsApp que te enviamos'}</h3>
          <p className="portal-help">
            {data.mode === 'live'
              ? 'Los mensajes se envían a tu correo y celular registrados.'
              : 'Modo demostración: los mensajes se registran aquí como “simulados”. Con las credenciales de correo (Gmail/SMTP) y Twilio en backend/.env se envían de verdad.'}
          </p>
        </div>
      </div>
      {error && <p className="form-status form-status--error">{error}</p>}
      {!events.length && !error && <p className="portal-empty">Aún no hay notificaciones.</p>}
      <div className="portal-list">
        {events.map(event => (
          <article className="notification-row" key={event.eventId}>
            <button type="button" className="notification-row__head" onClick={() => setOpen(open === event.eventId ? null : event.eventId)} aria-expanded={open === event.eventId}>
              <div>
                <strong>{event.subject}</strong>
                <span>{formatDateTime(event.createdAt)}{event.reference ? ` · ${event.reference}` : ''}</span>
              </div>
              <div className="notification-row__channels">
                {event.channels.map(item => (
                  <span key={item.id} className={`notification-chip notification-chip--${item.status}`} title={`${CHANNELS[item.channel]}: ${STATUS[item.status] || item.status}${item.error ? ` · ${item.error}` : ''}`}>
                    <ChannelIcon channel={item.channel} /> {CHANNELS[item.channel]}
                  </span>
                ))}
              </div>
            </button>
            {open === event.eventId && (
              <div className="notification-row__body">
                <pre>{event.body}</pre>
                <ul>
                  {event.channels.map(item => (
                    <li key={item.id}>{CHANNELS[item.channel]} → {item.recipient}: <strong>{STATUS[item.status] || item.status}</strong>{item.error ? ` (${item.error})` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
