import { useCallback, useEffect, useState } from 'react';
import { getServicesStatus, setServiceState } from '../../services/api';
import { formatDateTime } from '../../lib/roles';

/**
 * Consola del administrador → Microservicios.
 * Muestra el estado de cada microservicio y permite apagarlo o encenderlo para demostrar
 * que los demás siguen funcionando (tolerancia a fallos).
 */
export default function ServicesPanel() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ status: 'idle', text: '' });

  const load = useCallback(() => getServicesStatus()
    .then(setData)
    .catch(error => setMessage({ status: 'error', text: error.message })), []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const change = async (item, action) => {
    if (action === 'stop' && !window.confirm(`¿Apagar el microservicio "${item.name}"?\n\n${item.impact}`)) return;
    setBusy(item.name);
    try {
      const result = await setServiceState(item.name, action);
      setData(result);
      setMessage({
        status: 'success',
        text: action === 'stop'
          ? `Se apagó "${item.name}". Navega por el sitio: las demás secciones siguen funcionando.`
          : `Se encendió "${item.name}".`,
      });
    } catch (error) {
      setMessage({ status: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  };

  const items = data?.items || [];
  const down = items.filter(item => item.status !== 'ok').length;

  return (
    <>
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Tolerancia a fallos</span>
          <h3>Microservicios</h3>
        </div>
        <span className={`status-pill ${down ? 'status-pill--pending' : 'status-pill--completed'}`}>
          {data ? (down ? `${down} apagado(s) · sistema degradado` : 'Todos encendidos') : 'Consultando…'}
        </span>
      </div>
      <p className="services-panel__intro">
        Cada microservicio tiene su propio proceso y su propia base de datos. Si uno se apaga, el API Gateway responde
        “no disponible” solo para esa sección y el resto del portal sigue funcionando.
        {data?.control === 'supervisor' && data.autoRecoverMinutes > 0 && (
          <> Por seguridad, un servicio apagado desde aquí se vuelve a encender solo a los {data.autoRecoverMinutes} minutos.</>
        )}
      </p>
      {data?.control === 'docker' && (
        <p className="services-panel__intro">
          El backend corre con Docker: para apagar un servicio usa <code>docker compose stop pqrs</code> y para encenderlo
          {' '}<code>docker compose start pqrs</code>. Esta tabla se actualiza sola cada 5 segundos.
        </p>
      )}
      {message.text && <p className={`form-status form-status--${message.status}`} role="status">{message.text}</p>}
      <div className="services-panel">
        {items.map(item => {
          const on = item.status === 'ok';
          return (
            <article key={item.name} className={`services-panel__row${on ? '' : ' is-down'}`}>
              <div className="services-panel__main">
                <strong>{item.name}</strong>
                <span className="services-panel__label">{item.label} · puerto {item.port}</span>
                <span className="services-panel__impact">{on ? 'Si se apaga: ' : 'Mientras esté apagado: '}{item.impact}</span>
                {!on && item.recoverAt && (
                  <span className="services-panel__impact">Se encenderá solo el {formatDateTime(item.recoverAt)}</span>
                )}
              </div>
              <div className="services-panel__side">
                <span className={`status-pill ${on ? 'status-pill--completed' : 'status-pill--cancelled'}`}>{on ? 'Encendido' : 'Apagado'}</span>
                {data?.control === 'supervisor' && (on
                  ? <button type="button" className="btn btn--danger btn--sm" disabled={Boolean(busy)} onClick={() => change(item, 'stop')}>{busy === item.name ? 'Apagando…' : 'Apagar'}</button>
                  : <button type="button" className="btn btn--primary btn--sm" disabled={Boolean(busy)} onClick={() => change(item, 'start')}>{busy === item.name ? 'Encendiendo…' : 'Encender'}</button>)}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
