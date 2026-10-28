import { useCallback, useEffect, useState } from 'react';
import { cancelDoctorAbsence, createDoctorAbsence, getDoctorAbsences } from '../../services/api';
import { addDays, formatDate, todayBogota } from '../../lib/roles';

export const ABSENCE_LABELS = {
  incapacidad: 'Incapacidad médica',
  vacaciones: 'Vacaciones',
  licencia: 'Licencia',
  calamidad: 'Calamidad doméstica',
  capacitacion: 'Capacitación',
};

/**
 * Registro de una novedad del médico. Al guardar, el sistema reasigna sus citas a otro
 * médico de la misma especialidad a la misma hora o las deja "Por reprogramar".
 */
export function AbsenceForm({ doctorId, doctorName, onSaved, onCancel }) {
  const today = todayBogota();
  const [form, setForm] = useState({ type: 'incapacidad', startDate: today, endDate: today, notes: '' });
  const [state, setState] = useState({ status: 'idle', message: '' });

  const submit = async event => {
    event.preventDefault();
    if (form.endDate < form.startDate) { setState({ status: 'error', message: 'La fecha final no puede ser anterior a la inicial.' }); return; }
    const label = ABSENCE_LABELS[form.type].toLowerCase();
    if (!window.confirm(`¿Registrar ${label} ${doctorName ? `de ${doctorName} ` : ''}del ${formatDate(form.startDate)} al ${formatDate(form.endDate)}? Las citas de esos días se reasignarán o quedarán por reprogramar y se avisará a cada paciente.`)) return;
    setState({ status: 'loading', message: '' });
    try {
      const data = await createDoctorAbsence({ ...form, doctorId });
      onSaved?.(data);
      setState({ status: 'idle', message: '' });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  return (
    <form className="absence-form" onSubmit={submit}>
      <div className="form-row absence-form__row">
        <div className="form-group">
          <label htmlFor="absence-type">Tipo de novedad</label>
          <select id="absence-type" value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>
            {Object.entries(ABSENCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="absence-start">Desde</label>
          <input id="absence-start" type="date" min={addDays(today, -1)} value={form.startDate} required
            onChange={event => setForm({ ...form, startDate: event.target.value, endDate: event.target.value > form.endDate ? event.target.value : form.endDate })} />
        </div>
        <div className="form-group">
          <label htmlFor="absence-end">Hasta</label>
          <input id="absence-end" type="date" min={form.startDate} max={addDays(form.startDate, 180)} value={form.endDate} required
            onChange={event => setForm({ ...form, endDate: event.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="absence-notes">Observaciones (número de incapacidad, EPS que la expide…)</label>
        <input id="absence-notes" maxLength={500} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
      </div>
      {state.message && <p className={`form-status form-status--${state.status}`} role="alert">{state.message}</p>}
      <div className="service-form__actions">
        {onCancel && <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="btn btn--primary btn--sm" disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Reorganizando agenda…' : 'Registrar novedad'}
        </button>
      </div>
    </form>
  );
}

export function absenceResultMessage(data) {
  if (!data.affected) return 'Novedad registrada. No había citas asignadas en esas fechas.';
  const parts = [`Novedad registrada. ${data.affected} cita(s) afectada(s)`];
  if (data.reassigned.length) parts.push(`${data.reassigned.length} reasignada(s) a otro médico a la misma hora`);
  if (data.toReschedule.length) parts.push(`${data.toReschedule.length} quedaron “Por reprogramar” y el paciente elegirá un nuevo horario`);
  return `${parts.join(': ')}. Los pacientes fueron notificados por correo, SMS y WhatsApp.`;
}

/** Lista de novedades vigentes y próximas (con opción de anularlas). */
export function AbsenceList({ doctorId, adminMode = false, refreshKey }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const load = useCallback(() => {
    getDoctorAbsences(doctorId).then(data => setItems(data.items || [])).catch(error => setMessage(error.message));
  }, [doctorId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const cancel = async item => {
    if (!window.confirm('¿Anular esta novedad? Las citas que ya se reasignaron no se devuelven automáticamente.')) return;
    try {
      await cancelDoctorAbsence(item.id);
      load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const today = todayBogota();
  return (
    <div className="absence-list">
      {message && <p className="form-status form-status--error">{message}</p>}
      {!items.length && <p className="portal-empty">No hay novedades registradas.</p>}
      {items.map(item => (
        <article className={`absence-row ${item.endDate < today ? 'is-past' : ''}`} key={item.id}>
          <div>
            <strong>{ABSENCE_LABELS[item.type] || item.type}{adminMode && item.doctorName ? ` · ${item.doctorName}` : ''}</strong>
            <span>{formatDate(item.startDate)} → {formatDate(item.endDate)}{item.notes ? ` · ${item.notes}` : ''}</span>
            <span className="absence-row__meta">Registrada por {item.createdBy}</span>
          </div>
          {item.endDate >= today && <button type="button" className="btn btn--ghost btn--sm" onClick={() => cancel(item)}>Anular</button>}
        </article>
      ))}
    </div>
  );
}
