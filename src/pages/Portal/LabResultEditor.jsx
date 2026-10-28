import { useState } from 'react';
import { saveLabDocument } from '../../services/api';
import { formatDateTime } from '../../lib/roles';

/** Formulario del laboratorio para diligenciar, validar y publicar el documento de resultados. */
export default function LabResultEditor({ document, onSaved, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(document.items.map(item => [item.id, item.value || ''])));
  const [flags, setFlags] = useState(() => Object.fromEntries(document.items.map(item => [item.id, item.flag || ''])));
  const [observations, setObservations] = useState(document.observations || '');
  const [state, setState] = useState({ status: 'idle', message: '' });

  const save = async publish => {
    if (publish && !window.confirm('Al validar, el resultado queda publicado para el paciente y ya no se puede editar. ¿Continuar?')) return;
    setState({ status: 'loading', message: '' });
    try {
      const data = await saveLabDocument({
        orderNumber: document.orderNumber,
        items: Object.entries(values).map(([id, value]) => ({ id: Number(id), value })),
        observations,
        publish,
      });
      setFlags(Object.fromEntries(data.document.items.map(item => [item.id, item.flag || ''])));
      setState({ status: 'success', message: publish ? 'Resultado validado y publicado. El paciente ya puede consultarlo.' : 'Borrador guardado.' });
      onSaved?.(data.document, publish);
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  return (
    <div className="lab-editor">
      <div className="lab-editor__head">
        <div>
          <span className="portal-label">Orden {document.orderNumber}</span>
          <h3>{document.testName}</h3>
          <p>{document.patientName} · CC {document.patientDocument} · Muestra: {document.sampleType}</p>
          <p>Toma de muestra: {formatDateTime(document.sampleTakenAt)} por {document.sampleTakenBy}</p>
        </div>
        {onClose && <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Volver a la bandeja</button>}
      </div>

      <div className="lab-editor__table-wrap">
        <table>
          <thead><tr><th>Parámetro</th><th>Resultado</th><th>Unidad</th><th>Referencia</th></tr></thead>
          <tbody>
            {document.items.map(item => (
              <tr key={item.id}>
                <td>{item.parameter}</td>
                <td>
                  <div className="lab-editor__value">
                    <input value={values[item.id]} onChange={event => setValues({ ...values, [item.id]: event.target.value })} aria-label={`Resultado ${item.parameter}`} />
                    {flags[item.id] && <span className={`lab-report__flag lab-report__flag--${flags[item.id]}`}>{flags[item.id] === 'H' ? 'Alto' : 'Bajo'}</span>}
                  </div>
                </td>
                <td>{item.unit}</td>
                <td>{item.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-group">
        <label htmlFor="lab-observations">Observaciones del laboratorio</label>
        <textarea id="lab-observations" value={observations} onChange={event => setObservations(event.target.value)} placeholder="Condiciones de la muestra, comentarios técnicos…" />
      </div>
      <div className="lab-editor__actions">
        <button type="button" className="btn btn--ghost" onClick={() => save(false)} disabled={state.status === 'loading'}>Guardar borrador</button>
        <button type="button" className="btn btn--primary" onClick={() => save(true)} disabled={state.status === 'loading'}>Validar y publicar resultado</button>
      </div>
      {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
    </div>
  );
}
