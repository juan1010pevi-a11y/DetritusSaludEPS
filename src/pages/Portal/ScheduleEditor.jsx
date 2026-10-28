import { useMemo, useState } from 'react';
import { saveDoctorSchedule } from '../../services/api';
import { formatDate } from '../../lib/roles';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SLOT_OPTIONS = [10, 15, 20, 30, 40, 45, 60];

const toMinutes = time => {
  const [hours, minutes] = String(time || '0:0').split(':').map(Number);
  return hours * 60 + minutes;
};

/** Editor del horario semanal de un médico. El administrador además define especialidad, registro y estado. */
export default function ScheduleEditor({ doctor, isAdmin = false, specialties = [], onSaved, onCancel }) {
  const [blocks, setBlocks] = useState(() => (doctor.blocks || []).map((block, index) => ({ ...block, key: index })));
  const [slotMinutes, setSlotMinutes] = useState(doctor.slotMinutes || 20);
  const [site, setSite] = useState(doctor.site || '');
  const [specialty, setSpecialty] = useState(doctor.specialty || 'Medicina general');
  const [license, setLicense] = useState(doctor.license || '');
  const [active, setActive] = useState(doctor.hasProfile ? Boolean(doctor.active) : true);
  const [state, setState] = useState({ status: 'idle', message: '', conflicts: [] });

  const weeklySlots = useMemo(() => blocks.reduce((total, block) => {
    const span = toMinutes(block.end) - toMinutes(block.start);
    return total + (span > 0 ? Math.floor(span / Number(slotMinutes)) : 0);
  }, 0), [blocks, slotMinutes]);

  const update = (key, field, value) => setBlocks(list => list.map(block => (block.key === key ? { ...block, [field]: value } : block)));
  const remove = key => setBlocks(list => list.filter(block => block.key !== key));
  const add = weekday => {
    const sameDay = blocks.filter(block => block.weekday === weekday).sort((a, b) => toMinutes(a.end) - toMinutes(b.end));
    const last = sameDay[sameDay.length - 1];
    const startMinutes = last ? Math.min(toMinutes(last.end) + 60, 22 * 60) : 8 * 60;
    const endMinutes = Math.min(startMinutes + 4 * 60, 23 * 60);
    const asTime = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    setBlocks(list => [...list, { key: Date.now(), weekday, start: asTime(startMinutes), end: asTime(endMinutes) }]);
  };
  const copyMondayToWeek = () => {
    const monday = blocks.filter(block => block.weekday === 1);
    if (!monday.length) return;
    const others = [2, 3, 4, 5].flatMap(weekday => monday.map((block, index) => ({ ...block, weekday, key: `${weekday}-${index}-${Date.now()}` })));
    setBlocks([...blocks.filter(block => ![2, 3, 4, 5].includes(block.weekday)), ...others]);
  };

  const handleSave = async () => {
    setState({ status: 'loading', message: '', conflicts: [] });
    try {
      const data = await saveDoctorSchedule({
        doctorId: doctor.id,
        slotMinutes: Number(slotMinutes),
        site,
        blocks: blocks.map(({ weekday, start, end }) => ({ weekday, start, end })),
        ...(isAdmin ? { specialty, license, active } : {}),
      });
      setState({
        status: 'success',
        message: 'Horario guardado. Los cupos para agendar ya reflejan los cambios.',
        conflicts: data.conflicts || [],
      });
      onSaved?.(data.doctor);
    } catch (error) {
      setState({ status: 'error', message: error.message, conflicts: [] });
    }
  };

  return (
    <div className="schedule-editor">
      <div className="schedule-editor__settings">
        {isAdmin && (
          <>
            <div className="form-group">
              <label htmlFor={`specialty-${doctor.id}`}>Especialidad</label>
              <select id={`specialty-${doctor.id}`} value={specialty} onChange={event => setSpecialty(event.target.value)}>
                {specialties.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor={`license-${doctor.id}`}>Registro profesional</label>
              <input id={`license-${doctor.id}`} value={license} onChange={event => setLicense(event.target.value)} placeholder="RM 00000" />
            </div>
          </>
        )}
        <div className="form-group">
          <label htmlFor={`slot-${doctor.id}`}>Duración de cada cita</label>
          <select id={`slot-${doctor.id}`} value={slotMinutes} onChange={event => setSlotMinutes(Number(event.target.value))}>
            {SLOT_OPTIONS.map(option => <option key={option} value={option}>{option} minutos</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor={`site-${doctor.id}`}>Sede / consultorio</label>
          <input id={`site-${doctor.id}`} value={site} onChange={event => setSite(event.target.value)} placeholder="Sede Chapinero - Consultorio 204" />
        </div>
        {isAdmin && (
          <label className="schedule-editor__toggle">
            <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
            Habilitado para recibir citas
          </label>
        )}
      </div>

      <div className="schedule-editor__week">
        {WEEK_ORDER.map(weekday => {
          const dayBlocks = blocks.filter(block => block.weekday === weekday).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
          return (
            <div className={`schedule-editor__day ${dayBlocks.length ? '' : 'is-off'}`} key={weekday}>
              <span className="schedule-editor__day-name">{WEEKDAYS[weekday]}</span>
              <div className="schedule-editor__blocks">
                {dayBlocks.length === 0 && <span className="schedule-editor__off">No atiende</span>}
                {dayBlocks.map(block => (
                  <div className="schedule-editor__block" key={block.key}>
                    <input type="time" step="300" value={block.start} aria-label={`Inicio ${WEEKDAYS[weekday]}`} onChange={event => update(block.key, 'start', event.target.value)} />
                    <span>a</span>
                    <input type="time" step="300" value={block.end} aria-label={`Fin ${WEEKDAYS[weekday]}`} onChange={event => update(block.key, 'end', event.target.value)} />
                    <button type="button" className="schedule-editor__remove" onClick={() => remove(block.key)} aria-label="Quitar franja">×</button>
                  </div>
                ))}
              </div>
              <button type="button" className="schedule-editor__add" onClick={() => add(weekday)}>+ Franja</button>
            </div>
          );
        })}
      </div>

      <div className="schedule-editor__footer">
        <span className="schedule-editor__summary"><strong>{weeklySlots}</strong> cupos por semana de {slotMinutes} min</span>
        <div className="schedule-editor__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={copyMondayToWeek}>Copiar lunes a mar–vie</button>
          {onCancel && <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>}
          <button type="button" className="btn btn--primary btn--sm" onClick={handleSave} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Guardando…' : 'Guardar horario'}
          </button>
        </div>
      </div>
      {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
      {state.conflicts.length > 0 && (
        <div className="schedule-editor__conflicts">
          <strong>{state.conflicts.length} cita(s) ya asignada(s) quedan fuera del nuevo horario y se conservan:</strong>
          <ul>{state.conflicts.map(item => <li key={item.id}>{formatDate(item.date)} · {item.time}</li>)}</ul>
          <span>Reprográmalas o cancélalas desde la agenda si ya no podrás atenderlas.</span>
        </div>
      )}
    </div>
  );
}
