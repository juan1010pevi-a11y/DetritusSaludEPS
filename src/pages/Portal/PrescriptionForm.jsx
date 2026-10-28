import { useEffect, useState } from 'react';
import Modal from '../../components/Modal/Modal';
import { createPrescription, getPharmacyCatalog } from '../../services/api';

const emptyItem = () => ({ key: Date.now() + Math.random(), medication: '', dosage: '', quantity: '' });

/** El médico emite la fórmula al paciente que acaba de atender. */
export default function PrescriptionForm({ appointment, onClose, onSaved }) {
  const [medications, setMedications] = useState([]);
  const [items, setItems] = useState([emptyItem()]);
  const [instructions, setInstructions] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });

  useEffect(() => { getPharmacyCatalog().then(data => setMedications(data.medications || [])).catch(() => {}); }, []);

  const update = (key, field, value) => setItems(list => list.map(item => (item.key === key ? { ...item, [field]: value } : item)));

  const submit = async event => {
    event.preventDefault();
    setState({ status: 'loading', message: '' });
    try {
      const data = await createPrescription({
        appointmentId: appointment.id,
        instructions,
        items: items.map(({ medication, dosage, quantity }) => ({ medication, dosage, quantity: Number(quantity) })),
      });
      onSaved?.(data.formulaNumber);
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  return (
    <Modal title="Formular medicamentos" onClose={onClose} wide>
      <form className="prescription-form" onSubmit={submit}>
        <span className="portal-label">Fórmula médica</span>
        <h3>{appointment.patientName}</h3>
        <p className="portal-help">CC {appointment.patientDocument} · {appointment.specialty} · cita de las {appointment.time}</p>

        <datalist id="medication-catalog">{medications.map(item => <option key={item} value={item} />)}</datalist>
        <div className="prescription-form__items">
          {items.map((item, index) => (
            <div className="prescription-form__item" key={item.key}>
              <div className="form-group">
                <label htmlFor={`med-${item.key}`}>Medicamento {index + 1}</label>
                <input id={`med-${item.key}`} list="medication-catalog" value={item.medication} onChange={event => update(item.key, 'medication', event.target.value)} placeholder="Escribe o elige del listado PBS" required />
              </div>
              <div className="form-group">
                <label htmlFor={`dose-${item.key}`}>Dosis y frecuencia</label>
                <input id={`dose-${item.key}`} value={item.dosage} onChange={event => update(item.key, 'dosage', event.target.value)} placeholder="1 tableta cada 8 horas por 5 días" required />
              </div>
              <div className="form-group prescription-form__qty">
                <label htmlFor={`qty-${item.key}`}>Cantidad</label>
                <input id={`qty-${item.key}`} type="number" min="1" max="360" value={item.quantity} onChange={event => update(item.key, 'quantity', event.target.value)} required />
              </div>
              {items.length > 1 && <button type="button" className="schedule-editor__remove" onClick={() => setItems(list => list.filter(row => row.key !== item.key))} aria-label="Quitar medicamento">×</button>}
            </div>
          ))}
        </div>
        <button type="button" className="schedule-editor__add" onClick={() => setItems(list => [...list, emptyItem()])}>+ Agregar otro medicamento</button>

        <div className="form-group prescription-form__notes">
          <label htmlFor="rx-instructions">Indicaciones para el paciente</label>
          <textarea id="rx-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Ej.: tomar con comida, volver a control en 15 días…" />
        </div>
        {state.message && <p className="form-status form-status--error" role="alert">{state.message}</p>}
        <div className="service-form__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary btn--sm" disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Emitiendo…' : 'Emitir fórmula'}</button>
        </div>
      </form>
    </Modal>
  );
}
