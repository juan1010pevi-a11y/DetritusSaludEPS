import { useCallback, useEffect, useState } from 'react';
import Modal from '../../components/Modal/Modal';
import { getClinicalHistory, getMyClinicalHistory, saveClinicalBackground } from '../../services/api';
import { formatDate, formatLongDate, LAB_STATUS } from '../../lib/roles';
import { AUTH_STATUS } from '../../components/Documents/EpsDocuments';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const BACKGROUND_FIELDS = [
  ['allergies', 'Alergias'],
  ['personalHistory', 'Antecedentes personales (patológicos)'],
  ['surgicalHistory', 'Antecedentes quirúrgicos'],
  ['familyHistory', 'Antecedentes familiares'],
  ['currentMedications', 'Medicamentos de uso actual'],
  ['habits', 'Hábitos (tabaco, alcohol, actividad física)'],
];

function bmi(weight, height) {
  if (!weight || !height) return null;
  return (weight / ((height / 100) ** 2)).toFixed(1);
}

function Vitals({ encounter }) {
  const items = [
    ['TA', encounter.bloodPressure, 'mmHg'],
    ['FC', encounter.heartRate, 'lpm'],
    ['FR', encounter.respiratoryRate, 'rpm'],
    ['T°', encounter.temperature, '°C'],
    ['SatO₂', encounter.oxygenSaturation, '%'],
    ['Peso', encounter.weightKg, 'kg'],
    ['Talla', encounter.heightCm, 'cm'],
    ['IMC', bmi(encounter.weightKg, encounter.heightCm), ''],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!items.length) return null;
  return (
    <dl className="history-vitals">
      {items.map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{value} {unit}</dd></div>)}
    </dl>
  );
}

function BackgroundEditor({ patientId, background, onSaved }) {
  const [form, setForm] = useState(() => ({ bloodType: '', ...Object.fromEntries(BACKGROUND_FIELDS.map(([key]) => [key, ''])), ...(background || {}) }));
  const [state, setState] = useState({ status: 'idle', message: '' });
  const submit = async event => {
    event.preventDefault();
    setState({ status: 'loading', message: '' });
    try {
      onSaved(await saveClinicalBackground({ patientId, ...form }));
      setState({ status: 'success', message: 'Antecedentes actualizados.' });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };
  return (
    <form className="history-background-form" onSubmit={submit}>
      <div className="form-group">
        <label htmlFor="hc-blood">Grupo sanguíneo y RH</label>
        <select id="hc-blood" value={form.bloodType || ''} onChange={event => setForm({ ...form, bloodType: event.target.value })}>
          <option value="">Sin dato</option>
          {BLOOD_TYPES.map(type => <option key={type}>{type}</option>)}
        </select>
      </div>
      {BACKGROUND_FIELDS.map(([key, label]) => (
        <div className="form-group" key={key}>
          <label htmlFor={`hc-${key}`}>{label}</label>
          <textarea id={`hc-${key}`} rows={2} maxLength={1000} value={form[key] || ''} onChange={event => setForm({ ...form, [key]: event.target.value })} placeholder="Niega / sin dato" />
        </div>
      ))}
      {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
      <div className="service-form__actions">
        <button type="submit" className="btn btn--primary btn--sm" disabled={state.status === 'loading'}>Guardar antecedentes</button>
      </div>
    </form>
  );
}

/** Historia clínica completa: datos del paciente, antecedentes, evoluciones, fórmulas, órdenes y laboratorios. */
export function ClinicalHistoryView({ history, editable = false, onChange }) {
  const [editing, setEditing] = useState(false);
  const { patient, background, encounters, prescriptions, labs, orders } = history;
  return (
    <div className="history">
      <header className="history__patient">
        <div>
          <span className="portal-label">Historia clínica</span>
          <h3>{patient.name}</h3>
          <p className="portal-help">{patient.documentType || 'CC'} {patient.document} · {patient.plan}</p>
        </div>
        {background?.bloodType && <span className="history__blood" title="Grupo sanguíneo">{background.bloodType}</span>}
      </header>

      <section className="history__section">
        <div className="attend__section-head">
          <h4>Antecedentes</h4>
          {editable && !editing && <button type="button" className="schedule-editor__add" onClick={() => setEditing(true)}>Editar antecedentes</button>}
        </div>
        {editing ? (
          <BackgroundEditor patientId={patient.id} background={background} onSaved={data => { onChange?.(data); setEditing(false); }} />
        ) : (
          <dl className="history-background">
            {BACKGROUND_FIELDS.map(([key, label]) => (
              <div key={key} className={key === 'allergies' && background?.allergies ? 'is-alert' : ''}>
                <dt>{label}</dt>
                <dd>{background?.[key] || 'Sin dato registrado'}</dd>
              </div>
            ))}
          </dl>
        )}
        {background?.updatedBy && !editing && <p className="history__meta">Actualizado por {background.updatedBy} · {formatDate(background.updatedAt?.slice(0, 10))}</p>}
      </section>

      <section className="history__section">
        <h4>Evoluciones ({encounters.length})</h4>
        {!encounters.length && <p className="attend__empty">Aún no hay consultas registradas.</p>}
        <ol className="history-timeline">
          {encounters.map(item => (
            <li key={item.id}>
              <div className="history-timeline__head">
                <strong>{formatLongDate(item.date)}</strong>
                <span>{item.specialty} · {item.doctorName}</span>
              </div>
              <p><strong>Motivo:</strong> {item.chiefComplaint || '—'}</p>
              {item.currentIllness && <p><strong>Enfermedad actual:</strong> {item.currentIllness}</p>}
              <Vitals encounter={item} />
              {item.physicalExam && <p><strong>Examen físico:</strong> {item.physicalExam}</p>}
              <p className="history-timeline__dx"><strong>Diagnóstico:</strong> {item.diagnosis}{item.diagnosisCode ? ` (${item.diagnosisCode})` : ''}</p>
              {item.plan && <p><strong>Plan:</strong> {item.plan}</p>}
            </li>
          ))}
        </ol>
      </section>

      <div className="history__grid">
        <section className="history__section">
          <h4>Medicamentos formulados</h4>
          {!prescriptions.length && <p className="attend__empty">Sin fórmulas.</p>}
          <ul className="history-list">
            {prescriptions.map(item => (
              <li key={`${item.formulaNumber}-${item.medication}`}>
                <strong>{item.medication}</strong>
                <span>{item.dosage} · {item.quantity} und · {formatDate(item.issuedAt)} · {item.formulaNumber}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="history__section">
          <h4>Laboratorios y órdenes</h4>
          {!labs.length && !orders.length && <p className="attend__empty">Sin exámenes ni órdenes.</p>}
          <ul className="history-list">
            {labs.map(item => (
              <li key={item.id}>
                <strong>{item.testName}</strong>
                <span>{item.orderNumber} · {LAB_STATUS[item.status] || item.status}{item.result ? ` · ${item.result}` : ''}</span>
              </li>
            ))}
            {orders.map(item => (
              <li key={item.id}>
                <strong>{item.serviceName}</strong>
                <span>{item.id} · {AUTH_STATUS[item.status] || item.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Para el médico: abre la historia de un paciente de su agenda (puede editar antecedentes). */
export function ClinicalHistoryModal({ patientId, onClose }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getClinicalHistory(patientId).then(setHistory).catch(err => setError(err.message));
  }, [patientId]);
  return (
    <Modal title="Historia clínica" onClose={onClose} wide>
      {error && <p className="form-status form-status--error">{error}</p>}
      {!history && !error && <p className="portal-empty">Cargando historia clínica…</p>}
      {history && <ClinicalHistoryView history={history} editable onChange={setHistory} />}
    </Modal>
  );
}

/** Para el afiliado: su propia historia clínica (solo lectura). */
export function MyClinicalHistory() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    getMyClinicalHistory().then(setHistory).catch(err => setError(err.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <section className="portal-card">
      {error && <p className="form-status form-status--error">{error}</p>}
      {!history && !error && <p className="portal-empty">Cargando tu historia clínica…</p>}
      {history && (
        <>
          <ClinicalHistoryView history={history} />
          <p className="history__meta">La historia clínica es reservada (Resolución 1995 de 1999): solo la ven tú y los profesionales que te atienden. Puedes imprimirla desde el navegador.</p>
          <button type="button" className="btn btn--ghost btn--sm no-print" onClick={() => window.print()}>Imprimir / guardar en PDF</button>
        </>
      )}
    </section>
  );
}
