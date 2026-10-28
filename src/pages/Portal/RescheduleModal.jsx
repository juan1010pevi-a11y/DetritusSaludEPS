import { useEffect, useState } from 'react';
import Modal from '../../components/Modal/Modal';
import { getAvailability, rescheduleAppointment } from '../../services/api';
import { formatDate, formatLongDate, formatTime } from '../../lib/roles';

/**
 * El afiliado elige un nuevo cupo para una cita (por ejemplo, cuando su médico se incapacitó).
 * La disponibilidad ya excluye médicos ausentes y horarios que se cruzan con sus otras citas.
 */
export default function RescheduleModal({ appointment, onClose, onDone }) {
  const [availability, setAvailability] = useState(null);
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [state, setState] = useState({ status: 'loading', message: '' });

  useEffect(() => {
    getAvailability({ specialty: appointment.specialty, days: 21, excludeAppointmentId: appointment.id })
      .then(data => {
        setAvailability(data);
        setDay(data.days.find(item => item.total > 0)?.date || null);
        setState({ status: 'idle', message: '' });
      })
      .catch(error => setState({ status: 'error', message: error.message }));
  }, [appointment]);

  const confirm = async () => {
    setState({ status: 'loading', message: '' });
    try {
      const data = await rescheduleAppointment({ id: appointment.id, doctorId: slot.doctorId, date: day, time: slot.time });
      onDone(data.appointment);
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  const selectedDay = availability?.days.find(item => item.date === day);
  return (
    <Modal title="Reprogramar cita" onClose={onClose} wide>
      <div className="reschedule">
        <span className="portal-label">Reprogramar · {appointment.specialty}</span>
        <h3>Elige un nuevo horario</h3>
        <p className="portal-help">
          Cita actual: {formatLongDate(appointment.date)} · {formatTime(appointment.time)}
          {appointment.changeNote ? ` · ${appointment.changeNote}` : ''}
        </p>
        {state.status === 'loading' && !availability && <p className="portal-empty">Buscando cupos disponibles…</p>}
        {availability && !availability.days.some(item => item.total) && (
          <p className="portal-empty">No hay cupos disponibles en los próximos días. Comunícate con la línea de atención.</p>
        )}
        {availability && (
          <div className="reschedule__days">
            {availability.days.filter(item => item.total).map(item => (
              <button key={item.date} type="button" className={item.date === day ? 'is-active' : ''} onClick={() => { setDay(item.date); setSlot(null); }}>
                <strong>{item.weekday.slice(0, 3)}</strong>
                <span>{formatDate(item.date, { day: 'numeric', month: 'short' })}</span>
                <small>{item.total} cupos</small>
              </button>
            ))}
          </div>
        )}
        {selectedDay && (
          <div className="reschedule__slots">
            {selectedDay.slots.map(item => (
              <button key={`${item.doctorId}-${item.time}`} type="button"
                className={slot?.doctorId === item.doctorId && slot?.time === item.time ? 'is-active' : ''}
                onClick={() => setSlot(item)}>
                <strong>{formatTime(item.time)}</strong>
                <span>{item.doctorName}</span>
              </button>
            ))}
          </div>
        )}
        {state.message && <p className="form-status form-status--error" role="alert">{state.message}</p>}
        <div className="service-form__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn btn--primary btn--sm" disabled={!slot || state.status === 'loading'} onClick={confirm}>
            {slot ? `Confirmar ${formatDate(day, { day: 'numeric', month: 'short' })} · ${formatTime(slot.time)}` : 'Selecciona un horario'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
