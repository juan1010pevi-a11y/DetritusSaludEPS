import { useCallback, useEffect, useState } from 'react';
import LabReportModal from '../../components/LabReport/LabReport';
import ScheduleEditor from './ScheduleEditor';
import LabResultEditor from './LabResultEditor';
import PrescriptionForm from './PrescriptionForm';
import AttendAppointment from './AttendAppointment';
import AppointmentOutcome from './AppointmentOutcome';
import { ClinicalHistoryModal } from './ClinicalHistory';
import { ABSENCE_LABELS, AbsenceForm, AbsenceList, absenceResultMessage } from './Absences';
import NotificationsPanel from './NotificationsPanel';
import { getDoctorAgenda, getLabWorklist, updateAppointmentStatus } from '../../services/api';
import { addDays, APPOINTMENT_STATUS, formatDateTime, formatLongDate, formatTime, LAB_STATUS, todayBogota } from '../../lib/roles';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const LAB_SPECIALTY = 'Laboratorio clínico';

const toMinutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const weekdayOf = date => new Date(`${date}T12:00:00Z`).getUTCDay();

function slotsFor(doctor, date) {
  if (!doctor) return 0;
  return doctor.blocks
    .filter(block => block.weekday === weekdayOf(date))
    .reduce((total, block) => total + Math.floor((toMinutes(block.end) - toMinutes(block.start)) / doctor.slotMinutes), 0);
}

/**
 * Agenda del día de un médico (o de todos, para el administrador) con las acciones
 * de atención. Se reutiliza en la consola administrativa.
 */
export function AgendaView({ doctorId, adminMode = false, onLabSampleTaken }) {
  const [date, setDate] = useState(todayBogota());
  const [range, setRange] = useState(1);
  const [agenda, setAgenda] = useState({ items: [], doctor: null, absences: [], today: todayBogota() });
  const [state, setState] = useState({ status: 'loading', message: '' });
  const [prescribing, setPrescribing] = useState(null);
  const [attending, setAttending] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getDoctorAgenda({ date, days: range, doctorId });
      setAgenda(data);
      setState(current => (current.status === 'loading' ? { ...current, status: 'idle' } : current));
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }, [date, range, doctorId]);

  useEffect(() => { load(); }, [load]);

  const act = async (appointment, status) => {
    const labels = { completed: appointment.examCode ? 'registrar la toma de muestra' : 'marcar como atendida', no_show: 'marcar inasistencia', cancelled: 'cancelar' };
    if (!window.confirm(`¿Deseas ${labels[status]} la cita de ${appointment.patientName} (${appointment.time})?`)) return;
    try {
      const data = await updateAppointmentStatus(appointment.id, status);
      setState({
        status: 'success',
        message: data.labDocumentId
          ? `Muestra registrada. Se creó el documento de resultados de la orden ${appointment.labOrderNumber}; diligéncialo en la pestaña “Resultados de laboratorio”.`
          : status === 'completed' && !appointment.examCode
            ? 'Cita marcada como atendida. Si el paciente necesita medicamentos, usa “Formular medicamentos”.'
            : `Cita actualizada: ${APPOINTMENT_STATUS[status]}.`,
      });
      if (data.labDocumentId) onLabSampleTaken?.();
      load();
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  const doctor = agenda.doctor;
  const dayBlocks = doctor?.blocks.filter(block => block.weekday === weekdayOf(date)) || [];
  const activeCount = agenda.items.filter(item => item.status !== 'cancelled').length;
  const grouped = agenda.items.reduce((groups, item) => {
    (groups[item.date] = groups[item.date] || []).push(item);
    return groups;
  }, {});

  return (
    <div className="agenda">
      <div className="agenda__toolbar">
        <div className="agenda__nav">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(addDays(date, -range))} aria-label="Anterior">←</button>
          <input type="date" value={date} onChange={event => event.target.value && setDate(event.target.value)} />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(addDays(date, range))} aria-label="Siguiente">→</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(todayBogota())}>Hoy</button>
        </div>
        <div className="agenda__range">
          <button type="button" className={range === 1 ? 'is-active' : ''} onClick={() => setRange(1)}>Día</button>
          <button type="button" className={range === 7 ? 'is-active' : ''} onClick={() => setRange(7)}>7 días</button>
        </div>
      </div>

      {doctor && range === 1 && (
        <div className="agenda__summary">
          <strong>{formatLongDate(date)}</strong>
          {dayBlocks.length
            ? <span>Horario: {dayBlocks.map(block => `${block.start}–${block.end}`).join(' · ')} · {slotsFor(doctor, date)} cupos de {doctor.slotMinutes} min · {activeCount} asignados</span>
            : <span>No tienes horario de atención el {WEEKDAYS[weekdayOf(date)].toLowerCase()}.</span>}
        </div>
      )}

      {(agenda.absences || []).map(absence => (
        <p className="agenda__absence" key={absence.id}>
          <strong>{ABSENCE_LABELS[absence.type] || absence.type}</strong> del {formatLongDate(absence.startDate)} al {formatLongDate(absence.endDate)}
          {adminMode ? '' : ': no recibes citas nuevas en esas fechas y tus citas se reasignaron o quedaron por reprogramar.'}
        </p>
      ))}
      {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
      {state.status === 'loading' && <p className="portal-empty">Cargando agenda…</p>}
      {state.status !== 'loading' && !agenda.items.length && <p className="portal-empty">No hay citas asignadas en este periodo.</p>}

      {Object.entries(grouped).map(([day, items]) => (
        <div className="agenda__day" key={day}>
          {range > 1 && <h4 className="agenda__day-title">{formatLongDate(day)}</h4>}
          <div className="portal-list">
            {items.map(item => {
              const open = ['confirmed', 'requested'].includes(item.status);
              const canAttend = open && item.date <= agenda.today;
              return (
                <article className={`agenda-row ${open ? '' : 'is-closed'}`} key={item.id}>
                  <div className="agenda-row__time">{formatTime(item.time)}</div>
                  <div className="agenda-row__main">
                    <strong>{item.patientName}</strong>
                    <span>CC {item.patientDocument}{item.patientPhone ? ` · ${item.patientPhone}` : ''}</span>
                    <span>
                      {adminMode && `${item.doctorName} · `}{item.specialty} · {item.modality}
                      {item.examCode && ` · Orden ${item.labOrderNumber}`}
                    </span>
                    {item.reason && <span className="agenda-row__reason">Motivo: {item.reason}</span>}
                    {item.changeNote && <span className="agenda-row__note">{item.changeNote}</span>}
                    <AppointmentOutcome item={item} />
                    {open && !canAttend && !adminMode && (
                      <span className="agenda-row__hint">Podrás atenderla el {formatLongDate(item.date)}.</span>
                    )}
                  </div>
                  <div className="agenda-row__side">
                    <span className={`status-pill status-pill--${item.status}`}>{APPOINTMENT_STATUS[item.status]}</span>
                    {item.labStatus && <span className={`status-pill status-pill--${item.labStatus}`}>{LAB_STATUS[item.labStatus]}</span>}
                    {!adminMode && !item.examCode && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setHistoryOf(item.affiliateId)}>Historia clínica</button>
                    )}
                    {!adminMode && item.status === 'completed' && !item.examCode && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPrescribing(item)}>+ Fórmula adicional</button>
                    )}
                    {open && (
                      <div className="agenda-row__actions">
                        {!adminMode && !item.examCode && (
                          <button type="button" className="btn btn--primary btn--sm" disabled={!canAttend} title={canAttend ? '' : 'Disponible el día de la cita'} onClick={() => setAttending(item)}>
                            Atender cita
                          </button>
                        )}
                        {!adminMode && item.examCode && (
                          <button type="button" className="btn btn--primary btn--sm" disabled={!canAttend} onClick={() => act(item, 'completed')}>Muestra tomada</button>
                        )}
                        {canAttend && !adminMode && <button type="button" className="btn btn--ghost btn--sm" onClick={() => act(item, 'no_show')}>No asistió</button>}
                        <button type="button" className="btn btn--danger btn--sm" onClick={() => act(item, 'cancelled')}>Cancelar</button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
      {attending && (
        <AttendAppointment
          appointment={attending}
          onClose={() => setAttending(null)}
          onDone={result => {
            const patient = attending.patientName;
            setAttending(null);
            const parts = ['Cita atendida'];
            if (result.formulaNumber) parts.push(`fórmula ${result.formulaNumber} enviada a farmacia`);
            if (result.authorizations) parts.push(`${result.authorizations} orden(es) enviada(s) a autorización`);
            setState({ status: result.warning ? 'error' : 'success', message: result.warning || `${parts.join(' · ')} para ${patient}.` });
            load();
          }}
        />
      )}
      {historyOf && <ClinicalHistoryModal patientId={historyOf} onClose={() => setHistoryOf(null)} />}
      {prescribing && (
        <PrescriptionForm
          appointment={prescribing}
          onClose={() => setPrescribing(null)}
          onSaved={formulaNumber => {
            setPrescribing(null);
            load();
            setState({ status: 'success', message: `Fórmula ${formulaNumber} emitida para ${prescribing.patientName}. La farmacia ya la recibió y el paciente la ve en su portal.` });
          }}
        />
      )}
    </div>
  );
}

function LabWorkbench({ refreshKey }) {
  const [status, setStatus] = useState('processing');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    getLabWorklist(status).then(data => setItems(data.items || [])).catch(error => setMessage(error.message));
  }, [status]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (selected) {
    return (
      <LabResultEditor
        document={selected}
        onClose={() => { setSelected(null); load(); }}
        onSaved={(document, published) => {
          if (published) { setSelected(null); setMessage(`Resultado de la orden ${document.orderNumber} publicado.`); load(); }
        }}
      />
    );
  }

  return (
    <div>
      <div className="agenda__range agenda__range--left">
        <button type="button" className={status === 'processing' ? 'is-active' : ''} onClick={() => setStatus('processing')}>Pendientes de resultado</button>
        <button type="button" className={status === 'scheduled' ? 'is-active' : ''} onClick={() => setStatus('scheduled')}>Muestra pendiente</button>
        <button type="button" className={status === 'available' ? 'is-active' : ''} onClick={() => setStatus('available')}>Publicados</button>
      </div>
      {message && <p className="form-status form-status--success" role="status">{message}</p>}
      {!items.length && <p className="portal-empty">No hay órdenes en esta bandeja.</p>}
      <div className="portal-list">
        {items.map(item => (
          <article className="lab-row" key={item.id}>
            <div>
              <strong>{item.testName} · {item.orderNumber}</strong>
              <span>{item.patientName} · CC {item.patientDocument}</span>
              <span>
                {item.status === 'scheduled' && `Cita ${item.appointmentDate} ${item.appointmentTime}`}
                {item.status === 'processing' && `Muestra tomada ${formatDateTime(item.sampleTakenAt)}`}
                {item.status === 'available' && `Validado ${formatDateTime(item.validatedAt)} por ${item.validatedBy}`}
              </span>
            </div>
            <span className={`status-pill status-pill--${item.status}`}>{LAB_STATUS[item.status]}</span>
            {item.status === 'processing' && <button type="button" className="btn btn--primary btn--sm" onClick={() => setSelected(item)}>Registrar resultados</button>}
            {item.status === 'available' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReport(item)}>Ver documento</button>}
          </article>
        ))}
      </div>
      {report && <LabReportModal document={report} onClose={() => setReport(null)} />}
    </div>
  );
}

export default function DoctorPortal({ user }) {
  const isLab = user.doctor?.specialty === LAB_SPECIALTY;
  const [tab, setTab] = useState('agenda');
  const [labRefresh, setLabRefresh] = useState(0);
  const [profile, setProfile] = useState(null);
  const [agendaKey, setAgendaKey] = useState(0);
  const [absenceMessage, setAbsenceMessage] = useState('');

  useEffect(() => {
    getDoctorAgenda({ days: 1 }).then(data => setProfile(data.doctor)).catch(() => setProfile(null));
  }, [agendaKey]);

  return (
    <>
      <div className="portal-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'agenda'} className={tab === 'agenda' ? 'is-active' : ''} onClick={() => setTab('agenda')}>Mi agenda</button>
        {isLab && <button type="button" role="tab" aria-selected={tab === 'lab'} className={tab === 'lab' ? 'is-active' : ''} onClick={() => setTab('lab')}>Resultados de laboratorio</button>}
        <button type="button" role="tab" aria-selected={tab === 'schedule'} className={tab === 'schedule' ? 'is-active' : ''} onClick={() => setTab('schedule')}>Mi horario</button>
        <button type="button" role="tab" aria-selected={tab === 'absences'} className={tab === 'absences' ? 'is-active' : ''} onClick={() => setTab('absences')}>Incapacidades y novedades</button>
        <button type="button" role="tab" aria-selected={tab === 'notifications'} className={tab === 'notifications' ? 'is-active' : ''} onClick={() => setTab('notifications')}>Notificaciones</button>
      </div>
      {tab === 'notifications' && <NotificationsPanel />}

      {tab !== 'notifications' && <section className="portal-card">
        {tab === 'absences' && (
          <>
            <div className="portal-card__head">
              <div>
                <span className="portal-label">Novedades de agenda</span>
                <h3>Reportar incapacidad, vacaciones o licencia</h3>
                <p className="portal-help">Al registrarla, cada cita de esas fechas se reasigna a otro profesional de tu especialidad a la misma hora. Si no hay quien la atienda, queda “Por reprogramar” y el paciente elige un nuevo horario desde su portal. Todos reciben aviso por correo, SMS y WhatsApp.</p>
              </div>
            </div>
            <AbsenceForm onSaved={data => { setAbsenceMessage(absenceResultMessage(data)); setAgendaKey(key => key + 1); }} />
            {absenceMessage && <p className="form-status form-status--success" role="status">{absenceMessage}</p>}
            <h4 className="absence-list__title">Mis novedades</h4>
            <AbsenceList refreshKey={agendaKey} />
          </>
        )}
        {tab === 'agenda' && <AgendaView key={agendaKey} onLabSampleTaken={() => setLabRefresh(value => value + 1)} />}
        {tab === 'lab' && <LabWorkbench refreshKey={labRefresh} />}
        {tab === 'schedule' && profile && (
          <>
            <div className="portal-card__head">
              <div>
                <span className="portal-label">{profile.specialty} · {profile.license || 'Sin registro'}</span>
                <h3>Horario de atención semanal</h3>
                <p className="portal-help">Los pacientes solo pueden agendar en estas franjas. Cada franja se divide en cupos según la duración de la cita.</p>
              </div>
            </div>
            <ScheduleEditor doctor={profile} onSaved={doctor => { setProfile(doctor); setAgendaKey(key => key + 1); }} />
          </>
        )}
      </section>}
    </>
  );
}
