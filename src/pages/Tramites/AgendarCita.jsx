import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../../components/PageHero/PageHero';
import Alert from '../../components/Alert/Alert';
import { useAuth } from '../../context/AuthContext';
import { createAppointment, getAvailability, getDoctors, getSpecialties } from '../../services/api';
import { addDays, formatDate, formatLongDate, formatTime, todayBogota } from '../../lib/roles';
import './AgendarCita.css';
import { DocumentInput } from '../../components/FormFields/FormFields';

const DAYS_PER_PAGE = 14;
const TELECONSULT_SPECIALTIES = ['Medicina general', 'Medicina interna', 'Psicología'];
const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function scheduleText(blocks) {
  const byDay = {};
  blocks.forEach(block => { (byDay[block.weekday] = byDay[block.weekday] || []).push(`${block.start}–${block.end}`); });
  return [1, 2, 3, 4, 5, 6, 0].filter(day => byDay[day]).map(day => ({ day: WEEKDAYS_SHORT[day], hours: byDay[day].join(', ') }));
}

function AccessGate() {
  const { user, roles, switchRole, openLogin } = useAuth();
  const [error, setError] = useState('');
  if (!user) {
    return (
      <div className="info-card booking-gate">
        <h2>Ingresa para agendar tu cita</h2>
        <p>Para asignarte un cupo real con el profesional necesitamos validar tu afiliación. Ingresa con tu documento y contraseña.</p>
        <button type="button" className="btn btn--primary" onClick={() => openLogin({ role: 'affiliate', redirect: '/tramites/agendar-cita' })}>Ingresar como afiliado</button>
        <p className="booking-gate__small">¿No tienes cuenta? <Link to="/tramites/afiliacion-contributivo">Regístrate</Link></p>
      </div>
    );
  }
  return (
    <div className="info-card booking-gate">
      <h2>Estás con perfil de médico</h2>
      <p>Las citas se agendan como paciente. {roles.includes('affiliate') ? 'Cambia a tu perfil de afiliado para continuar.' : 'Este documento no tiene perfil de afiliado.'}</p>
      {roles.includes('affiliate') && (
        <button type="button" className="btn btn--primary" onClick={() => switchRole('affiliate').catch(err => setError(err.message))}>Cambiar a perfil afiliado</button>
      )}
      {error && <p className="form-status form-status--error">{error}</p>}
    </div>
  );
}

export default function AgendarCita() {
  const { user, role } = useAuth();
  const canBook = user && ['affiliate', 'administrator'].includes(role);

  const [catalog, setCatalog] = useState({ items: [], labExams: [] });
  const [specialty, setSpecialty] = useState('');
  const [examCode, setExamCode] = useState('');
  const [modality, setModality] = useState('Presencial');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [reason, setReason] = useState('');
  const [patientDocument, setPatientDocument] = useState('');

  const [from, setFrom] = useState(todayBogota());
  const [availability, setAvailability] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [state, setState] = useState({ status: 'idle', message: '' });
  const [confirmation, setConfirmation] = useState(null);

  const isLab = specialty === 'Laboratorio clínico';
  const exam = catalog.labExams.find(item => item.code === examCode);

  useEffect(() => {
    getSpecialties().then(setCatalog).catch(() => setState({ status: 'error', message: 'No fue posible cargar las especialidades. Verifica que Healthcare Service esté activo.' }));
  }, []);

  useEffect(() => {
    setDoctorId('');
    setDoctors([]);
    if (!specialty) return;
    getDoctors(specialty).then(data => setDoctors(data.items || [])).catch(() => setDoctors([]));
    if (!TELECONSULT_SPECIALTIES.includes(specialty)) setModality('Presencial');
  }, [specialty]);

  const loadAvailability = useCallback(async (keepSelection = false) => {
    if (!specialty) return;
    setLoadingSlots(true);
    try {
      // Para el call center, la disponibilidad también descarta horas que se cruzan con otras citas del paciente.
      const patient = role === 'administrator' && /^\d{5,12}$/.test(patientDocument) ? patientDocument : undefined;
      const data = await getAvailability({ specialty, doctorId: doctorId || undefined, from, days: DAYS_PER_PAGE, document: patient });
      setAvailability(data);
      if (!keepSelection) {
        const firstDay = data.days.find(day => day.total > 0);
        setSelectedDate(firstDay?.date || '');
        setSelectedSlot(null);
      }
    } catch (error) {
      setState({ status: 'error', message: error.message });
    } finally {
      setLoadingSlots(false);
    }
  }, [specialty, doctorId, from, role, patientDocument]);

  useEffect(() => { loadAvailability(); }, [loadAvailability]);

  const day = availability?.days.find(item => item.date === selectedDate);
  const slotsByDoctor = useMemo(() => {
    const groups = new Map();
    (day?.slots || []).forEach(slot => {
      if (!groups.has(slot.doctorId)) groups.set(slot.doctorId, { doctorId: slot.doctorId, doctorName: slot.doctorName, site: slot.site, duration: slot.duration, slots: [] });
      groups.get(slot.doctorId).slots.push(slot);
    });
    return [...groups.values()];
  }, [day]);

  const totalSlots = availability?.days.reduce((total, item) => total + item.total, 0) ?? 0;
  const today = todayBogota();

  const confirm = async () => {
    if (!selectedSlot) return;
    if (isLab && !examCode) { setState({ status: 'error', message: 'Selecciona el examen de laboratorio.' }); return; }
    setState({ status: 'loading', message: '' });
    try {
      const data = await createAppointment({
        specialty,
        doctorId: selectedSlot.doctorId,
        date: selectedDate,
        time: selectedSlot.time,
        modality,
        examCode: isLab ? examCode : undefined,
        reason,
        document: role === 'administrator' ? patientDocument : undefined,
      });
      setConfirmation({ ...data.appointment, preparation: data.preparation });
      setState({ status: 'idle', message: '' });
    } catch (error) {
      setState({ status: 'error', message: error.message });
      if (error.status === 409) loadAvailability(true);
    }
  };

  const reset = () => {
    setConfirmation(null);
    setSelectedSlot(null);
    setReason('');
    loadAvailability();
  };

  return (
    <>
      <PageHero
        label="Servicios digitales"
        title="Agendar cita médica"
        description="Elige la especialidad y escoge un cupo real dentro del horario de atención de nuestros profesionales."
        image="/img/atencion-usuario.jpg"
        breadcrumb={[{ label: 'Trámites', path: '/tramites' }, { label: 'Agendar cita' }]}
      />
      <section className="content-section">
        <div className="container appointment-layout">
          <div className="booking">
            {!canBook && <AccessGate />}

            {canBook && confirmation && (
              <div className="info-card booking-success">
                <span className="booking-success__check" aria-hidden="true">✓</span>
                <h2>¡Tu cita quedó confirmada!</h2>
                <p>Te enviamos la confirmación a tu correo y celular registrados.</p>
                <dl className="booking-success__details">
                  <div><dt>Número de cita</dt><dd>{confirmation.id}</dd></div>
                  <div><dt>Paciente</dt><dd>{confirmation.patientName}</dd></div>
                  <div><dt>Especialidad</dt><dd>{confirmation.specialty}</dd></div>
                  <div><dt>Profesional</dt><dd>{confirmation.doctorName}</dd></div>
                  <div><dt>Fecha</dt><dd>{formatLongDate(confirmation.date)}</dd></div>
                  <div><dt>Hora</dt><dd>{formatTime(confirmation.time)}</dd></div>
                  <div><dt>Modalidad</dt><dd>{confirmation.modality}</dd></div>
                  <div><dt>Lugar</dt><dd>{confirmation.site}</dd></div>
                  {confirmation.labOrderNumber && <div><dt>Orden de laboratorio</dt><dd>{confirmation.labOrderNumber}</dd></div>}
                </dl>
                {confirmation.labOrderNumber && (
                  <Alert type="info">
                    <strong>Preparación:</strong> {confirmation.preparation} Con el número de orden <strong>{confirmation.labOrderNumber}</strong> podrás consultar tus resultados cuando el laboratorio los publique.
                  </Alert>
                )}
                <p className="booking-success__note">Llega 15 minutos antes con tu documento. Si no puedes asistir, cancela desde tu portal para liberar el cupo.</p>
                <div className="booking-success__actions">
                  <Link to="/portal" className="btn btn--primary">Ver mis citas</Link>
                  <button type="button" className="btn btn--ghost" onClick={reset}>Agendar otra cita</button>
                </div>
              </div>
            )}

            {canBook && !confirmation && (
              <>
                <div className="info-card booking-step">
                  <h2><span className="booking-step__num">1</span> ¿Qué servicio necesitas?</h2>
                  {role === 'administrator' && (
                    <div className="form-group">
                      <label htmlFor="patient-document">Documento del afiliado (agendamiento por call center)</label>
                      <DocumentInput id="patient-document" value={patientDocument} onChange={event => setPatientDocument(event.target.value)} />
                    </div>
                  )}
                  <div className="specialty-grid">
                    {catalog.items.map(item => (
                      <button
                        type="button"
                        key={item.name}
                        disabled={!item.doctors}
                        className={`specialty-option ${specialty === item.name ? 'is-active' : ''}`}
                        onClick={() => { setSpecialty(item.name); setFrom(todayBogota()); setState({ status: 'idle', message: '' }); }}
                      >
                        <strong>{item.name}</strong>
                        <span>{item.doctors ? `${item.doctors} profesional${item.doctors > 1 ? 'es' : ''}` : 'Sin agenda'}</span>
                      </button>
                    ))}
                  </div>

                  {specialty && (
                    <div className="form-row booking-step__options">
                      {isLab ? (
                        <div className="form-group">
                          <label htmlFor="exam">Examen ordenado</label>
                          <select id="exam" value={examCode} onChange={event => setExamCode(event.target.value)}>
                            <option value="">Selecciona el examen</option>
                            {catalog.labExams.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="form-group">
                          <label htmlFor="modality">Modalidad</label>
                          <select id="modality" value={modality} onChange={event => setModality(event.target.value)}>
                            <option>Presencial</option>
                            {TELECONSULT_SPECIALTIES.includes(specialty) && <option>Teleconsulta</option>}
                          </select>
                        </div>
                      )}
                      <div className="form-group">
                        <label htmlFor="doctor">Profesional</label>
                        <select id="doctor" value={doctorId} onChange={event => setDoctorId(event.target.value)}>
                          <option value="">Cualquier profesional disponible</option>
                          {doctors.filter(item => item.id !== user.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {isLab && exam && <Alert type="info"><strong>{exam.name}</strong> · Muestra: {exam.sample}. {exam.preparation}</Alert>}
                </div>

                {specialty && (
                  <div className="info-card booking-step">
                    <h2><span className="booking-step__num">2</span> Elige el día</h2>
                    <div className="day-strip__nav">
                      <span>{availability ? `${totalSlots} cupos entre el ${formatDate(availability.days[0]?.date)} y el ${formatDate(availability.days[availability.days.length - 1]?.date)}` : 'Cargando…'}</span>
                      <div>
                        <button type="button" className="btn btn--ghost btn--sm" disabled={from <= today} onClick={() => setFrom(addDays(from, -DAYS_PER_PAGE) < today ? today : addDays(from, -DAYS_PER_PAGE))}>← Anteriores</button>
                        <button type="button" className="btn btn--ghost btn--sm" disabled={addDays(from, DAYS_PER_PAGE) > addDays(today, 29)} onClick={() => setFrom(addDays(from, DAYS_PER_PAGE))}>Más fechas →</button>
                      </div>
                    </div>
                    <div className={`day-strip ${loadingSlots ? 'is-loading' : ''}`}>
                      {availability?.days.map(item => {
                        const date = new Date(`${item.date}T12:00:00Z`);
                        return (
                          <button
                            key={item.date}
                            type="button"
                            disabled={!item.total}
                            className={`day-chip ${selectedDate === item.date ? 'is-active' : ''}`}
                            onClick={() => { setSelectedDate(item.date); setSelectedSlot(null); }}
                          >
                            <span className="day-chip__weekday">{WEEKDAYS_SHORT[date.getUTCDay()]}</span>
                            <strong>{date.getUTCDate()}</strong>
                            <span className="day-chip__month">{formatDate(item.date, { month: 'short' })}</span>
                            <span className="day-chip__count">{item.total ? `${item.total} cupos` : 'Sin cupos'}</span>
                          </button>
                        );
                      })}
                    </div>
                    {availability && !totalSlots && (
                      <Alert type="gold">No hay cupos disponibles en estas fechas{doctorId ? ' con el profesional elegido' : ''}. Prueba con más fechas u otro profesional.</Alert>
                    )}
                  </div>
                )}

                {specialty && day && day.total > 0 && (
                  <div className="info-card booking-step">
                    <h2><span className="booking-step__num">3</span> Elige la hora · <span className="booking-step__date">{formatLongDate(day.date)}</span></h2>
                    <div className="slot-groups">
                      {slotsByDoctor.map(group => (
                        <div className="slot-group" key={group.doctorId}>
                          <div className="slot-group__head">
                            <strong>{group.doctorName}</strong>
                            <span>{group.site} · {group.duration} min</span>
                          </div>
                          <div className="slot-group__times">
                            {group.slots.map(slot => (
                              <button
                                key={slot.time}
                                type="button"
                                className={`slot ${selectedSlot?.doctorId === slot.doctorId && selectedSlot?.time === slot.time ? 'is-active' : ''}`}
                                onClick={() => setSelectedSlot(slot)}
                              >
                                {formatTime(slot.time)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSlot && (
                  <div className="info-card booking-step booking-confirm">
                    <h2><span className="booking-step__num">4</span> Confirma tu cita</h2>
                    <p className="booking-confirm__summary">
                      <strong>{specialty}{exam ? ` · ${exam.name}` : ''}</strong> con <strong>{selectedSlot.doctorName}</strong> el{' '}
                      <strong>{formatLongDate(selectedDate)}</strong> a las <strong>{formatTime(selectedSlot.time)}</strong> · {modality} · {modality === 'Teleconsulta' ? 'Recibirás el enlace por correo' : selectedSlot.site}
                    </p>
                    {isLab && (
                      <div className={`form-group ${examCode ? '' : 'booking-required'}`}>
                        <label htmlFor="exam-confirm">Examen que te vas a realizar <span className="booking-required__mark">*</span></label>
                        <select id="exam-confirm" value={examCode} onChange={event => setExamCode(event.target.value)}>
                          <option value="">Selecciona el examen de tu orden médica</option>
                          {catalog.labExams.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                        </select>
                        {!examCode && <span className="booking-required__hint">Elige el examen para poder confirmar la cita.</span>}
                        {exam && <span className="booking-required__prep">Preparación: {exam.preparation}</span>}
                      </div>
                    )}
                    <div className="form-group">
                      <label htmlFor="reason">{isLab ? 'Observaciones' : 'Motivo de la consulta'} <span className="booking-optional">(opcional)</span></label>
                      <textarea id="reason" maxLength="300" value={reason} onChange={event => setReason(event.target.value)} placeholder={isLab ? 'Ej.: medicamentos que tomas, si estás en ayunas…' : 'Cuéntale brevemente al profesional el motivo de tu cita'} />
                    </div>
                    <button type="button" className="btn btn--primary" onClick={confirm} disabled={state.status === 'loading' || (isLab && !examCode)}>
                      {state.status === 'loading' ? 'Confirmando…' : 'Confirmar cita'}
                    </button>
                  </div>
                )}
                {state.message && <p className={`form-status form-status--${state.status}`} role="alert">{state.message}</p>}
              </>
            )}
          </div>

          <aside className="appointment-aside">
            {specialty && doctors.length > 0 && (
              <div className="appointment-note appointment-note--schedule">
                <span className="appointment-note__label">Horarios de atención</span>
                <h3>{specialty}</h3>
                <div className="doctor-schedules">
                  {doctors.filter(item => item.id !== user?.id).map(doctor => (
                    <div className="doctor-schedule" key={doctor.id}>
                      <strong>{doctor.name}</strong>
                      <span>{doctor.site}</span>
                      <ul>
                        {scheduleText(doctor.blocks).map(item => <li key={item.day}><b>{item.day}</b> {item.hours}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="appointment-note">
              <span className="appointment-note__label">Antes de agendar</span>
              <h3>Ten presente</h3>
              <ul>
                <li>Solo verás cupos dentro del horario de atención de cada profesional.</li>
                <li>Puedes tener una cita activa por especialidad; cancélala desde tu portal si no puedes asistir.</li>
                <li>Los exámenes de laboratorio generan una orden con la que consultarás tus resultados.</li>
                <li>Para una urgencia, acude al servicio de urgencias más cercano.</li>
              </ul>
            </div>
            <Alert type="info">Las citas de medicina general pueden solicitarse también por nuestra línea nacional 018000 123 456.</Alert>
          </aside>
        </div>
      </section>
    </>
  );
}
