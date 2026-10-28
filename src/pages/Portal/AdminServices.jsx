import { useCallback, useEffect, useState } from 'react';
import {
  AUTH_STATUS, AuthorizationDocument, FormulaDocument, groupFormulas, PRESCRIPTION_STATUS, PrintableModal,
} from '../../components/Documents/EpsDocuments';
import {
  decideAuthorization, getAuthorizationQueue, getPharmacyCatalog, getPrescriptionQueue, updatePrescriptionStatus,
} from '../../services/api';
import { formatDate, formatDateTime } from '../../lib/roles';

function StatusFilter({ value, onChange, options }) {
  return (
    <div className="agenda__range agenda__range--left">
      {options.map(([key, label]) => (
        <button key={key} type="button" className={value === key ? 'is-active' : ''} onClick={() => onChange(key)}>{label}</button>
      ))}
    </div>
  );
}

// ---------- Auditoría de autorizaciones ----------
export function AuthorizationQueue() {
  const [status, setStatus] = useState('requested');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({});
  const [message, setMessage] = useState({ status: 'idle', text: '' });
  const [document, setDocument] = useState(null);

  const load = useCallback(() => {
    getAuthorizationQueue(status).then(data => setItems(data.items || [])).catch(error => setMessage({ status: 'error', text: error.message }));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const decide = async (item, decision) => {
    if (decision === 'denied' && (notes[item.id] || '').trim().length < 5) {
      setMessage({ status: 'error', text: 'Para negar, escribe el motivo en las observaciones.' });
      return;
    }
    try {
      const data = await decideAuthorization(item.id, decision, notes[item.id]);
      setMessage({
        status: 'success',
        text: decision === 'approved'
          ? `Aprobada: ${data.authorization.authNumber} para ${item.patientName}.`
          : `Solicitud ${item.id} negada. El afiliado verá el motivo.`,
      });
      load();
    } catch (error) {
      setMessage({ status: 'error', text: error.message });
    }
  };

  return (
    <>
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Auditoría médica</span>
          <h3>Solicitudes de autorización</h3>
          <p className="portal-help">Revisa la orden médica y aprueba o niega. Al aprobar se genera el número de autorización, el prestador y la vigencia de 90 días.</p>
        </div>
      </div>
      <StatusFilter value={status} onChange={setStatus} options={[['requested', 'Pendientes'], ['approved', 'Aprobadas'], ['denied', 'Negadas']]} />
      {message.text && <p className={`form-status form-status--${message.status}`} role="status">{message.text}</p>}
      {!items.length && <p className="portal-empty">No hay solicitudes en esta bandeja.</p>}
      <div className="portal-list">
        {items.map(item => (
          <article className="queue-row" key={item.id}>
            <div className="queue-row__main">
              <strong>{item.serviceName}</strong>
              <span>{item.patientName} · CC {item.patientDocument} · {item.plan}</span>
              <span>Orden {item.orderReference} de {item.orderedBy} · radicada {formatDateTime(item.createdAt)}</span>
              <span className="queue-row__reason">“{item.reason}”</span>
              {item.priority === 'prioritaria' && <span className="queue-row__priority">Prioritaria</span>}
            </div>
            <div className="queue-row__side">
              <span className={`status-pill status-pill--${item.status}`}>{AUTH_STATUS[item.status]}</span>
              {item.status === 'requested' ? (
                <>
                  <textarea placeholder="Observaciones (obligatorio para negar)" value={notes[item.id] || ''} onChange={event => setNotes({ ...notes, [item.id]: event.target.value })} />
                  <div className="agenda-row__actions">
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => decide(item, 'denied')}>Negar</button>
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => decide(item, 'approved')}>Aprobar</button>
                  </div>
                </>
              ) : (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDocument(item)}>Ver documento</button>
              )}
            </div>
          </article>
        ))}
      </div>
      {document && (
        <PrintableModal title="Autorización" onClose={() => setDocument(null)} canPrint={document.status === 'approved'}>
          <AuthorizationDocument item={document} />
        </PrintableModal>
      )}
    </>
  );
}

// ---------- Farmacia ----------
export function PharmacyQueue() {
  const [status, setStatus] = useState('pending');
  const [formulas, setFormulas] = useState([]);
  const [points, setPoints] = useState([]);
  const [chosenPoint, setChosenPoint] = useState({});
  const [message, setMessage] = useState({ status: 'idle', text: '' });
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    getPrescriptionQueue(status).then(data => setFormulas(groupFormulas(data.items || []))).catch(error => setMessage({ status: 'error', text: error.message }));
  }, [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getPharmacyCatalog().then(data => setPoints(data.deliveryPoints || [])).catch(() => {}); }, []);

  const advance = async (formula, next) => {
    try {
      await updatePrescriptionStatus(formula.formulaNumber, next, chosenPoint[formula.formulaNumber] || points[0]);
      setMessage({ status: 'success', text: next === 'available' ? `Fórmula ${formula.formulaNumber} lista para entrega.` : `Fórmula ${formula.formulaNumber} entregada.` });
      load();
    } catch (error) {
      setMessage({ status: 'error', text: error.message });
    }
  };

  return (
    <>
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Servicio farmacéutico</span>
          <h3>Dispensación de fórmulas</h3>
          <p className="portal-help">Las fórmulas que emiten los médicos llegan aquí. Alístalas indicando el punto de entrega y regístralas como entregadas cuando el afiliado las reclame.</p>
        </div>
      </div>
      <StatusFilter value={status} onChange={setStatus} options={[['pending', 'Por alistar'], ['available', 'Listas para entrega'], ['delivered', 'Entregadas']]} />
      {message.text && <p className={`form-status form-status--${message.status}`} role="status">{message.text}</p>}
      {!formulas.length && <p className="portal-empty">No hay fórmulas en esta bandeja.</p>}
      <div className="portal-list">
        {formulas.map(formula => (
          <article className="queue-row" key={formula.formulaNumber}>
            <div className="queue-row__main">
              <strong>Fórmula {formula.formulaNumber}</strong>
              <span>{formula.items[0].patientName} · CC {formula.items[0].patientDocument} · {formatDate(formula.items[0].issuedAt)} · {formula.items[0].doctorName || 'Médico tratante'}</span>
              <ul className="formula-row__items">
                {formula.items.map(item => <li key={item.id}><strong>{item.medication}</strong> · {item.dosage} · {item.quantity} und.</li>)}
              </ul>
              {formula.items[0].deliveryPoint && <span>Punto: {formula.items[0].deliveryPoint}</span>}
            </div>
            <div className="queue-row__side">
              <span className={`status-pill status-pill--${formula.status}`}>{PRESCRIPTION_STATUS[formula.status]}</span>
              {formula.status === 'pending' && (
                <>
                  <select value={chosenPoint[formula.formulaNumber] || points[0] || ''} onChange={event => setChosenPoint({ ...chosenPoint, [formula.formulaNumber]: event.target.value })}>
                    {points.map(point => <option key={point}>{point}</option>)}
                  </select>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => advance(formula, 'available')}>Marcar lista para entrega</button>
                </>
              )}
              {formula.status === 'available' && <button type="button" className="btn btn--primary btn--sm" onClick={() => advance(formula, 'delivered')}>Registrar entrega</button>}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(formula)}>Ver fórmula</button>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <PrintableModal title="Fórmula médica" onClose={() => setSelected(null)}>
          <FormulaDocument formula={selected} />
        </PrintableModal>
      )}
    </>
  );
}
