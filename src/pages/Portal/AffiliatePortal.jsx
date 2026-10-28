import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthorizationsPanel, CertificatePanel, MedicationsPanel } from './AffiliateServices';
import AppointmentOutcome from './AppointmentOutcome';
import LabReportModal from '../../components/LabReport/LabReport';
import { MyClinicalHistory } from './ClinicalHistory';
import NotificationsPanel from './NotificationsPanel';
import RescheduleModal from './RescheduleModal';
import { PQRS_STATUS } from './PqrsQueue';
import { getMyAppointments, getMyLabResults, getMyPqrs, updateAppointmentStatus } from '../../services/api';
import { APPOINTMENT_STATUS, formatDate, formatLongDate, formatTime, LAB_STATUS, todayBogota } from '../../lib/roles';

const TABS = [
  ['resumen', 'Mis citas y resultados'],
  ['autorizaciones', 'Autorizaciones'],
  ['medicamentos', 'Medicamentos'],
  ['historia', 'Mi historia clínica'],
  ['certificado', 'Certificado de afiliación'],
  ['notificaciones', 'Notificaciones'],
];

export default function AffiliatePortal({ user }) {
  const { search } = useLocation();
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(search).get('tab');
    return TABS.some(([key]) => key === requested) ? requested : 'resumen';
  });
  const [appointments, setAppointments] = useState([]);
  const [labs, setLabs] = useState([]);
  const [pqrs, setPqrs] = useState([]);
  const [state, setState] = useState({ status: 'loading', message: '' });
  const [report, setReport] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);

  const load = useCallback(async () => {
    try {
      const [mine, labData, pqrsData] = await Promise.all([
        getMyAppointments(),
        getMyLabResults(),
        getMyPqrs().catch(() => ({ items: [] })),
      ]);
      setAppointments(mine.items || []);
      setLabs(labData.items || []);
      setPqrs(pqrsData.items || []);
      // Conserva el mensaje de la última acción (cancelar, reprogramar…).
      setState(current => (current.status === 'loading' ? { status: 'idle', message: '' } : current));
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const today = todayBogota();
  const upcoming = appointments
    .filter(item => item.status === 'reschedule_required' || (['confirmed', 'requested'].includes(item.status) && item.date >= today))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const history = appointments.filter(item => !upcoming.includes(item));

  const cancel = async appointment => {
    if (!window.confirm(`¿Cancelar tu cita de ${appointment.specialty} del ${formatDate(appointment.date)} a las ${appointment.time}? El cupo quedará libre para otro paciente.`)) return;
    try {
      await updateAppointmentStatus(appointment.id, 'cancelled');
      setState({ status: 'success', message: 'Cita cancelada. El cupo quedó disponible.' });
      load();
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  const openTab = key => { setTab(key); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const tabs = (
    <div className="portal-tabs" role="tablist">
      {TABS.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>
      ))}
    </div>
  );

  if (tab !== 'resumen') {
    return (
      <>
        {tabs}
        {tab === 'autorizaciones' && <AuthorizationsPanel />}
        {tab === 'medicamentos' && <MedicationsPanel />}
        {tab === 'certificado' && <CertificatePanel user={user} />}
        {tab === 'historia' && <MyClinicalHistory />}
        {tab === 'notificaciones' && <NotificationsPanel />}
      </>
    );
  }

  return (
    <>
      {tabs}
      <div className="portal-stats">
        <div className="portal-stat"><span>Próximas citas</span><strong>{upcoming.length}</strong></div>
        <div className="portal-stat"><span>Resultados disponibles</span><strong>{labs.filter(item => item.status === 'available').length}</strong></div>
        <div className="portal-stat"><span>Exámenes en proceso</span><strong>{labs.filter(item => ['scheduled', 'processing'].includes(item.status)).length}</strong></div>
        <div className="portal-stat"><span>PQRS</span><strong>{pqrs.length}</strong></div>
      </div>

      {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}

      <div className="portal-grid">
        <section className="portal-card">
          <div className="portal-card__head">
            <div><span className="portal-label">Agenda</span><h3>Mis próximas citas</h3></div>
            <Link to="/tramites/agendar-cita" className="btn btn--primary btn--sm">Agendar cita</Link>
          </div>
          {state.status === 'loading' && <p className="portal-empty">Cargando…</p>}
          {state.status !== 'loading' && !upcoming.length && <p className="portal-empty">No tienes citas programadas.</p>}
          <div className="portal-list">
            {upcoming.map(item => (
              <article className={`appointment-row ${item.status === 'reschedule_required' ? 'is-warning' : ''}`} key={item.id}>
                <div className="appointment-row__date">
                  <strong>{item.date.slice(8, 10)}</strong>
                  <span>{formatDate(item.date, { month: 'short' })}</span>
                </div>
                <div className="appointment-row__main">
                  <strong>{item.specialty}{item.examCode ? ` · ${item.labOrderNumber}` : ''}</strong>
                  <span>{formatLongDate(item.date)} · {formatTime(item.time)}</span>
                  <span>{item.status === 'reschedule_required' ? `Antes con ${item.originalDoctorName || 'tu médico'}` : `${item.doctorName} · ${item.modality} · ${item.site}`}</span>
                  {item.changeNote && <span className="appointment-row__note">{item.changeNote}</span>}
                </div>
                <div className="appointment-row__side">
                  <span className={`status-pill status-pill--${item.status}`}>{APPOINTMENT_STATUS[item.status]}</span>
                  <button type="button" className={`btn btn--sm ${item.status === 'reschedule_required' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setRescheduling(item)}>Reprogramar</button>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => cancel(item)}>Cancelar</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card__head">
            <div><span className="portal-label">Laboratorio</span><h3>Mis resultados</h3></div>
            <Link to="/afiliados/resultados-laboratorio" className="btn btn--ghost btn--sm">Consultar por orden</Link>
          </div>
          {!labs.length && state.status !== 'loading' && <p className="portal-empty">No tienes órdenes de laboratorio.</p>}
          <div className="portal-list">
            {labs.map(item => (
              <article className="lab-row" key={item.id}>
                <div>
                  <strong>{item.testName}</strong>
                  <span>Orden {item.orderNumber} · {item.status === 'available' ? `Validado ${formatDate(item.resultDate)}` : item.appointmentDate ? `Cita ${formatDate(item.appointmentDate)} ${item.appointmentTime}` : ''}</span>
                </div>
                <span className={`status-pill status-pill--${item.status}`}>{LAB_STATUS[item.status]}</span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReport(item)}>
                  {item.status === 'available' ? 'Ver documento' : 'Ver estado'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="portal-card">
        <div className="portal-card__head">
          <div><span className="portal-label">Historial</span><h3>Citas anteriores y canceladas</h3></div>
        </div>
        {!history.length && <p className="portal-empty">Aún no hay historial.</p>}
        {history.length > 0 && (
          <div className="portal-table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Especialidad</th><th>Profesional</th><th>Estado</th><th>Resultado de la atención</th></tr></thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id}>
                    <td>{formatDate(item.date)} {item.time || ''}</td>
                    <td>{item.specialty}</td>
                    <td>{item.doctorName || '—'}</td>
                    <td><span className={`status-pill status-pill--${item.status}`}>{APPOINTMENT_STATUS[item.status] || item.status}</span></td>
                    <td className="outcome-cell"><AppointmentOutcome item={item} onOpenTab={openTab} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pqrs.length > 0 && (
        <section className="portal-card">
          <div className="portal-card__head">
            <div><span className="portal-label">Atención al usuario</span><h3>Mis PQRS</h3></div>
            <Link to="/tramites/radicar-pqrsd" className="btn btn--ghost btn--sm">Radicar PQRS</Link>
          </div>
          <div className="portal-list">
            {pqrs.map(item => (
              <article className="lab-row" key={item.id}>
                <div>
                  <strong>{item.type} · {item.subject}</strong>
                  <span>{item.id} · radicada {formatDate(item.createdAt?.slice(0, 10))} · respuesta máxima {formatDate(item.dueDate)}</span>
                  {item.response && <span className="appointment-row__note">Respuesta: {item.response}</span>}
                </div>
                <span className={`status-pill status-pill--pqrs-${item.status}`}>{PQRS_STATUS[item.status] || item.status}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="portal-quick">
        <Link to="/tramites/radicar-pqrsd" className="btn btn--ghost">Radicar PQRS</Link>
        <button type="button" className="btn btn--ghost" onClick={() => openTab('autorizaciones')}>Autorizaciones</button>
        <button type="button" className="btn btn--ghost" onClick={() => openTab('medicamentos')}>Medicamentos</button>
        <button type="button" className="btn btn--ghost" onClick={() => openTab('historia')}>Mi historia clínica</button>
        <button type="button" className="btn btn--ghost" onClick={() => openTab('certificado')}>Certificado de afiliación</button>
      </div>

      {report && <LabReportModal document={report} onClose={() => setReport(null)} />}
      {rescheduling && (
        <RescheduleModal
          appointment={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={appointment => {
            setRescheduling(null);
            setState({ status: 'success', message: `Cita reprogramada para el ${formatLongDate(appointment.date)} a las ${formatTime(appointment.time)} con ${appointment.doctorName}. Te enviamos la confirmación.` });
            load();
          }}
        />
      )}
    </>
  );
}
