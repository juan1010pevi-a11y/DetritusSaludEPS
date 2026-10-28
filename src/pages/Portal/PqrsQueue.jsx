import { useCallback, useEffect, useState } from 'react';
import { getPqrsQueue, updatePqrs } from '../../services/api';
import { formatDate, formatDateTime } from '../../lib/roles';

export const PQRS_STATUS = { received: 'Recibida', in_review: 'En revisión', answered: 'Respondida', closed: 'Cerrada' };

/** Bandeja de atención al usuario: revisar, responder y cerrar PQRS (se notifica al ciudadano). */
export default function PqrsQueue() {
  const [status, setStatus] = useState('open');
  const [data, setData] = useState({ items: [], today: '' });
  const [responses, setResponses] = useState({});
  const [message, setMessage] = useState({ status: 'idle', text: '' });

  const load = useCallback(() => {
    getPqrsQueue(status).then(setData).catch(error => setMessage({ status: 'error', text: error.message }));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const change = async (item, next) => {
    try {
      await updatePqrs(item.id, { status: next, response: responses[item.id] });
      setMessage({ status: 'success', text: `PQRS ${item.id}: ${PQRS_STATUS[next]}. Se notificó a ${item.requesterName} por correo, SMS y WhatsApp.` });
      setResponses({ ...responses, [item.id]: '' });
      load();
    } catch (error) {
      setMessage({ status: 'error', text: error.message });
    }
  };

  return (
    <>
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Atención al usuario</span>
          <h3>PQRS radicadas</h3>
          <p className="portal-help">Ordenadas por fecha límite legal (15 días hábiles; 30 para denuncias). Cada cambio de estado se notifica al ciudadano.</p>
        </div>
      </div>
      <div className="agenda__range agenda__range--left">
        {[['open', 'Abiertas'], ['answered', 'Respondidas'], ['closed', 'Cerradas'], ['all', 'Todas']].map(([key, label]) => (
          <button key={key} type="button" className={status === key ? 'is-active' : ''} onClick={() => setStatus(key)}>{label}</button>
        ))}
      </div>
      {message.text && <p className={`form-status form-status--${message.status}`} role="status">{message.text}</p>}
      {!data.items.length && <p className="portal-empty">No hay PQRS en esta bandeja.</p>}
      <div className="portal-list">
        {data.items.map(item => {
          const overdue = ['received', 'in_review'].includes(item.status) && item.dueDate < data.today;
          return (
            <article className="queue-row" key={item.id}>
              <div className="queue-row__main">
                <strong>{item.type} · {item.subject}</strong>
                <span>{item.id} · {item.requesterName} · {item.documentType} {item.document}</span>
                <span>Radicada {formatDateTime(item.createdAt)} · Responder antes del <b className={overdue ? 'is-overdue' : ''}>{formatDate(item.dueDate)}</b>{overdue ? ' (vencida)' : ''}</span>
                <span className="queue-row__reason">“{item.description}”</span>
                {item.response && <span className="queue-row__answer"><strong>Respuesta:</strong> {item.response}</span>}
              </div>
              <div className="queue-row__side">
                <span className={`status-pill status-pill--pqrs-${item.status}`}>{PQRS_STATUS[item.status]}</span>
                {['received', 'in_review'].includes(item.status) && (
                  <>
                    <textarea placeholder="Respuesta al ciudadano (mínimo 20 caracteres)" value={responses[item.id] || ''}
                      onChange={event => setResponses({ ...responses, [item.id]: event.target.value })} />
                    <div className="agenda-row__actions">
                      {item.status === 'received' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => change(item, 'in_review')}>En revisión</button>}
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => change(item, 'answered')}>Responder</button>
                    </div>
                  </>
                )}
                {item.status === 'answered' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => change(item, 'closed')}>Cerrar caso</button>}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
