import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import Alert from '../../components/Alert/Alert';
import { DocumentInput } from '../../components/FormFields/FormFields';
import { getPqrsById } from '../../services/api';
import { formatDate, formatDateTime } from '../../lib/roles';
import { documentError } from '../../lib/validators';
import './EstadoPqrsd.css';

const STATUS = { received: 'Recibida', in_review: 'En revisión', answered: 'Respondida', closed: 'Cerrada' };

export default function EstadoPqrsd() {
  const [documentType, setDocumentType] = useState('CC');
  const [state, setState] = useState({ status: 'idle', message: '' });
  const [request, setRequest] = useState(null);

  const handleSubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const caseNumber = String(form.get('caseNumber') || '').trim().toUpperCase();
    const document = String(form.get('document') || '').trim();
    const problem = (!/^PQRS-\d{4}-\d{6}$/.test(caseNumber) ? 'El radicado tiene el formato PQRS-AAAA-NNNNNN.' : null) || documentError(document, documentType);
    if (problem) { setState({ status: 'error', message: problem }); return; }
    try {
      const data = await getPqrsById(caseNumber, document);
      setRequest(data.items?.[0] || null);
      setState(data.items?.length ? { status: 'idle', message: '' } : { status: 'error', message: 'No encontramos una solicitud con ese radicado y documento.' });
    } catch (error) {
      setRequest(null);
      setState({ status: 'error', message: error.message || 'No fue posible consultar el estado de la solicitud.' });
    }
  };

  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Estado de tus PQRSD"
        icon="📝"
        description="Consulta peticiones, quejas, reclamos, sugerencias y denuncias."
        image="/img/estado-pqrsd.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Estado de tus PQRSD' },
        ]}
      />
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header"><span className="section-label">Seguimiento de solicitudes</span><h2 className="section-heading">Consulta el estado de tu PQRSD</h2><p className="tramite-content__intro">Ten a la mano el número de radicado y el documento con el que registraste la solicitud.</p></div>
          <form className="info-card tramite-form pqrs-form" onSubmit={handleSubmit}>
            <h2>Consultar PQRSD</h2>
            <p className="pqrs-form__intro">Ingresa los datos con los que registraste tu solicitud.</p>
            <div className="form-group">
              <label htmlFor="case-number">Número de radicado</label>
              <input id="case-number" name="caseNumber" type="text" placeholder="PQRS-2026-123456" maxLength={16} pattern="[Pp][Qq][Rr][Ss]-\d{4}-\d{6}" title="Formato PQRS-AAAA-NNNNNN" required
                onChange={event => { event.target.value = event.target.value.toUpperCase(); }} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="document-type">Tipo de documento</label>
                <select id="document-type" value={documentType} onChange={event => setDocumentType(event.target.value)}>
                  <option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="TI">Tarjeta de identidad</option><option value="PA">Pasaporte</option><option value="PPT">PPT</option>
                </select>
              </div>
              <div className="form-group"><label htmlFor="document-number">Número de documento</label><DocumentInput id="document-number" name="document" documentType={documentType} required /></div>
            </div>
            <button className="btn btn--primary" type="submit">Consultar estado</button>
            {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
            {request && (
              <div className="pqrs-result">
                <p><strong>{request.id}</strong> · {request.type} · {request.subject}</p>
                <p>Estado: <span className={`status-pill status-pill--pqrs-${request.status}`}>{STATUS[request.status] || request.status}</span> · Respuesta máxima: {formatDate(request.dueDate)}</p>
                {request.response && <p className="pqrs-result__answer"><strong>Respuesta de la EPS:</strong> {request.response}</p>}
                <ol className="pqrs-result__history">
                  {request.history.map(item => (
                    <li key={`${item.status}-${item.changedAt}`}>{formatDateTime(item.changedAt)} — {STATUS[item.status] || item.status}{item.note ? `: ${item.note}` : ''}</li>
                  ))}
                </ol>
              </div>
            )}
          </form>
          <Alert type="info">Tiempos legales orientativos: peticiones y quejas hasta 15 días hábiles; denuncias hasta 30 días hábiles.</Alert>
        </div>
      </section>
    </>
  );
}
