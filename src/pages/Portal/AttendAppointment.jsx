import { useEffect, useState } from 'react';
import Modal from '../../components/Modal/Modal';
import { attendAppointment, createPrescription, getAuthorizationCatalog, getPharmacyCatalog } from '../../services/api';
import { formatLongDate, formatTime } from '../../lib/roles';
import { bloodPressureError, numberInRangeError } from '../../lib/validators';
import { ClinicalHistoryModal } from './ClinicalHistory';

const VITALS = [
  ['bloodPressure', 'Tensión arterial', 'mmHg', '120/80'],
  ['heartRate', 'Frec. cardiaca', 'lpm', '72', { min: 30, max: 220, integer: true }],
  ['respiratoryRate', 'Frec. respiratoria', 'rpm', '16', { min: 8, max: 60, integer: true }],
  ['temperature', 'Temperatura', '°C', '36.5', { min: 34, max: 42 }],
  ['oxygenSaturation', 'Saturación O₂', '%', '98', { min: 50, max: 100, integer: true }],
  ['weightKg', 'Peso', 'kg', '70', { min: 1, max: 350 }],
  ['heightCm', 'Talla', 'cm', '170', { min: 30, max: 230 }],
];

function vitalsError(vitals) {
  for (const [key, label, , , range] of VITALS) {
    const error = key === 'bloodPressure'
      ? bloodPressureError(vitals[key])
      : numberInRangeError(vitals[key], { ...range, label });
    if (error) return error;
  }
  return null;
}

const newMedication = () => ({ key: Math.random(), medication: '', dosage: '', quantity: '' });
const newOrder = () => ({ key: Math.random(), serviceCode: '', reason: '', priority: 'normal' });

/**
 * Consulta médica: el médico registra el diagnóstico, formula medicamentos y emite
 * órdenes que requieren autorización. Al finalizar, la cita queda como atendida.
 */
export default function AttendAppointment({ appointment, onClose, onDone }) {
  const [clinical, setClinical] = useState({ chiefComplaint: appointment.reason || '', currentIllness: '', physicalExam: '', diagnosisCode: '' });
  const [vitals, setVitals] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState([]);
  const [instructions, setInstructions] = useState('');
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState({ medications: [], services: [] });
  const [state, setState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    Promise.all([getPharmacyCatalog().catch(() => ({})), getAuthorizationCatalog().catch(() => ({}))])
      .then(([pharmacy, auth]) => setCatalog({ medications: pharmacy.medications || [], services: auth.items || [] }));
  }, []);

  const updateRow = (setter, key, field, value) => setter(list => list.map(row => (row.key === key ? { ...row, [field]: value } : row)));
  const removeRow = (setter, key) => setter(list => list.filter(row => row.key !== key));

  const submit = async event => {
    event.preventDefault();
    const problem = vitalsError(vitals);
    if (problem) { setState({ status: 'error', message: problem }); return; }
    setState({ status: 'loading', message: '' });
    const meds = medications.filter(row => row.medication.trim());
    try {
      const result = await attendAppointment({
        id: appointment.id,
        ...clinical,
        vitals,
        diagnosis,
        plan: notes,
        authorizations: orders.filter(row => row.serviceCode).map(({ serviceCode, reason, priority }) => ({ serviceCode, reason, priority })),
      });
      let formulaNumber = null;
      if (meds.length) {
        try {
          const rx = await createPrescription({
            appointmentId: appointment.id,
            instructions,
            items: meds.map(({ medication, dosage, quantity }) => ({ medication, dosage, quantity: Number(quantity) })),
          });
          formulaNumber = rx.formulaNumber;
        } catch (error) {
          onDone?.({ ...result, warning: `La cita quedó atendida, pero la fórmula no se pudo emitir: ${error.message} Usa “Formular medicamentos” para intentarlo de nuevo.` });
          return;
        }
      }
      onDone?.({ ...result, formulaNumber });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  return (
    <Modal title="Atender cita" onClose={onClose} wide>
      <form className="attend" onSubmit={submit}>
        <span className="portal-label">Consulta · {appointment.specialty}</span>
        <h3>{appointment.patientName}</h3>
        <p className="portal-help">CC {appointment.patientDocument} · {formatLongDate(appointment.date)} · {formatTime(appointment.time)} · {appointment.modality}</p>
        {appointment.reason && <p className="attend__reason">Motivo que indicó el paciente: “{appointment.reason}”</p>}

        <button type="button" className="btn btn--ghost btn--sm attend__history" onClick={() => setShowHistory(true)}>Ver historia clínica del paciente</button>

        <section className="attend__section">
          <h4>1. Anamnesis</h4>
          <div className="form-group">
            <label htmlFor="attend-complaint">Motivo de consulta *</label>
            <input id="attend-complaint" value={clinical.chiefComplaint} maxLength={500} required minLength="3"
              onChange={event => setClinical({ ...clinical, chiefComplaint: event.target.value })} placeholder="Lo que refiere el paciente" />
          </div>
          <div className="form-group">
            <label htmlFor="attend-illness">Enfermedad actual</label>
            <textarea id="attend-illness" rows={2} value={clinical.currentIllness} maxLength={2000}
              onChange={event => setClinical({ ...clinical, currentIllness: event.target.value })} placeholder="Inicio, evolución, síntomas asociados…" />
          </div>
        </section>

        <section className="attend__section">
          <h4>2. Signos vitales y examen físico</h4>
          <div className="attend__vitals">
            {VITALS.map(([key, label, unit, placeholder]) => (
              <div className="form-group" key={key}>
                <label htmlFor={`vital-${key}`}>{label} <small>({unit})</small></label>
                <input id={`vital-${key}`} inputMode="decimal" placeholder={placeholder} value={vitals[key] || ''}
                  onChange={event => setVitals({ ...vitals, [key]: key === 'bloodPressure' ? event.target.value.replace(/[^\d/]/g, '').slice(0, 7) : event.target.value.replace(/[^\d.,]/g, '').slice(0, 6) })} />
              </div>
            ))}
          </div>
          <div className="form-group">
            <label htmlFor="attend-exam">Examen físico</label>
            <textarea id="attend-exam" rows={2} value={clinical.physicalExam} maxLength={2000}
              onChange={event => setClinical({ ...clinical, physicalExam: event.target.value })} placeholder="Hallazgos por sistemas" />
          </div>
        </section>

        <section className="attend__section">
          <h4>3. Diagnóstico y plan</h4>
          <div className="form-row attend__dx-row">
            <div className="form-group">
              <label htmlFor="attend-dx">Diagnóstico / impresión diagnóstica *</label>
              <input id="attend-dx" value={diagnosis} onChange={event => setDiagnosis(event.target.value)} placeholder="Ej.: Lumbalgia mecánica" required minLength="3" />
            </div>
            <div className="form-group">
              <label htmlFor="attend-cie">Código CIE-10</label>
              <input id="attend-cie" value={clinical.diagnosisCode} maxLength={6} placeholder="M54.5" pattern="[A-Za-z][0-9]{2}(\.?[0-9]{1,2})?" title="Letra + 2 dígitos, ej. I10 o M54.5"
                onChange={event => setClinical({ ...clinical, diagnosisCode: event.target.value.toUpperCase() })} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="attend-notes">Plan de manejo y recomendaciones</label>
            <textarea id="attend-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Tratamiento, recomendaciones y control…" />
          </div>
        </section>

        <section className="attend__section">
          <div className="attend__section-head">
            <h4>4. Medicamentos (fórmula médica)</h4>
            <button type="button" className="schedule-editor__add" onClick={() => setMedications(list => [...list, newMedication()])}>+ Agregar medicamento</button>
          </div>
          {!medications.length && <p className="attend__empty">Sin medicamentos. Agrégalos si el paciente los necesita.</p>}
          <datalist id="attend-medications">{catalog.medications.map(item => <option key={item} value={item} />)}</datalist>
          {medications.map(row => (
            <div className="prescription-form__item" key={row.key}>
              <div className="form-group"><label>Medicamento</label><input list="attend-medications" value={row.medication} onChange={event => updateRow(setMedications, row.key, 'medication', event.target.value)} placeholder="Escribe o elige del listado PBS" required /></div>
              <div className="form-group"><label>Dosis y frecuencia</label><input value={row.dosage} onChange={event => updateRow(setMedications, row.key, 'dosage', event.target.value)} placeholder="1 tableta cada 8 horas por 5 días" required /></div>
              <div className="form-group prescription-form__qty"><label>Cantidad</label><input type="number" min="1" max="360" value={row.quantity} onChange={event => updateRow(setMedications, row.key, 'quantity', event.target.value)} required /></div>
              <button type="button" className="schedule-editor__remove" onClick={() => removeRow(setMedications, row.key)} aria-label="Quitar">×</button>
            </div>
          ))}
          {medications.length > 0 && (
            <div className="form-group attend__instructions">
              <label htmlFor="attend-instructions">Indicaciones de la fórmula</label>
              <input id="attend-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Ej.: tomar con las comidas" />
            </div>
          )}
        </section>

        <section className="attend__section">
          <div className="attend__section-head">
            <h4>5. Órdenes que requieren autorización</h4>
            <button type="button" className="schedule-editor__add" onClick={() => setOrders(list => [...list, newOrder()])}>+ Agregar orden</button>
          </div>
          {!orders.length && <p className="attend__empty">Sin órdenes. Agrega exámenes, terapias, especialistas o procedimientos si los necesita.</p>}
          {orders.map(row => (
            <div className="attend__order" key={row.key}>
              <div className="form-group">
                <label>Servicio</label>
                <select value={row.serviceCode} onChange={event => updateRow(setOrders, row.key, 'serviceCode', event.target.value)} required>
                  <option value="">Selecciona el servicio</option>
                  {catalog.services.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Justificación clínica</label>
                <input value={row.reason} onChange={event => updateRow(setOrders, row.key, 'reason', event.target.value)} placeholder="Por qué lo necesita" required minLength="5" />
              </div>
              <div className="form-group">
                <label>Prioridad</label>
                <select value={row.priority} onChange={event => updateRow(setOrders, row.key, 'priority', event.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="prioritaria">Prioritaria</option>
                </select>
              </div>
              <button type="button" className="schedule-editor__remove" onClick={() => removeRow(setOrders, row.key)} aria-label="Quitar">×</button>
            </div>
          ))}
          {orders.length > 0 && <p className="attend__empty">Las órdenes pasan a auditoría de la EPS; el paciente verá su estado en Mis autorizaciones.</p>}
        </section>

        {state.message && <p className="form-status form-status--error" role="alert">{state.message}</p>}
        <p className="attend__empty">Al finalizar, la consulta queda registrada en la historia clínica del paciente.</p>
        <div className="service-form__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary btn--sm" disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Guardando…' : 'Finalizar atención'}</button>
        </div>
      </form>
      {showHistory && <ClinicalHistoryModal patientId={appointment.affiliateId} onClose={() => setShowHistory(false)} />}
    </Modal>
  );
}
