import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ScheduleEditor from './ScheduleEditor';
import AddDoctorForm from './AddDoctorForm';
import { AuthorizationQueue, PharmacyQueue } from './AdminServices';
import { AgendaView } from './DoctorPortal';
import { ABSENCE_LABELS, AbsenceForm, AbsenceList, absenceResultMessage } from './Absences';
import NotificationsPanel from './NotificationsPanel';
import PqrsQueue from './PqrsQueue';
import { getAdminDoctors, getRoleUsers, getStaffOverview, updateUserRoles } from '../../services/api';
import { formatDate, ROLE_ORDER, roleLabel } from '../../lib/roles';

const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function scheduleSummary(blocks) {
  if (!blocks.length) return 'Sin horario asignado';
  const byDay = {};
  blocks.forEach(block => { (byDay[block.weekday] = byDay[block.weekday] || []).push(`${block.start}–${block.end}`); });
  return [1, 2, 3, 4, 5, 6, 0].filter(day => byDay[day]).map(day => `${WEEKDAYS_SHORT[day]} ${byDay[day].join(', ')}`).join(' · ');
}

function DoctorsPanel() {
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [editing, setEditing] = useState(null);
  const [absenceFor, setAbsenceFor] = useState(null);
  const [absenceKey, setAbsenceKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    getAdminDoctors()
      .then(data => { setDoctors(data.items || []); setSpecialties(data.specialties || []); })
      .catch(error => setMessage(error.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Red de prestadores</span>
          <h3>Médicos y horarios de atención</h3>
          <p className="portal-help">La disponibilidad de citas se calcula con estos horarios. Un médico nuevo no recibe citas hasta que le asignes un horario.</p>
        </div>
        {!adding && <button type="button" className="btn btn--primary btn--sm" onClick={() => { setAdding(true); setNotice(''); }}>+ Agregar médico</button>}
      </div>
      {adding && (
        <AddDoctorForm
          specialties={specialties}
          onCancel={() => setAdding(false)}
          onCreated={data => {
            setAdding(false);
            setNotice(data.created
              ? `${data.doctor.name} quedó creado como médico. Ahora asígnale su horario de atención.`
              : `Se agregó el perfil de médico a ${data.doctor.name} (mismo documento y contraseña). Ahora asígnale su horario.`);
            setEditing(data.doctor.id);
            load();
          }}
        />
      )}
      {notice && <p className="form-status form-status--success" role="status">{notice}</p>}
      {message && <p className="form-status form-status--error">{message}</p>}
      <div className="portal-list">
        {doctors.map(doctor => (
          <article className={`doctor-row ${editing === doctor.id ? 'is-editing' : ''}`} key={doctor.id}>
            <div className="doctor-row__head">
              <div>
                <strong>{doctor.name}</strong>
                <span>{doctor.specialty || 'Sin especialidad'} · {doctor.license || 'Sin registro'} · CC {doctor.document}</span>
                <span className="doctor-row__schedule">{scheduleSummary(doctor.blocks)}{doctor.blocks.length ? ` · ${doctor.slotMinutes} min/cita` : ''}</span>
                {(doctor.absences || []).map(absence => (
                  <span className="doctor-row__absence" key={absence.id}>
                    {ABSENCE_LABELS[absence.type] || absence.type}: {formatDate(absence.startDate)} → {formatDate(absence.endDate)}
                  </span>
                ))}
              </div>
              <div className="doctor-row__side">
                <span className={`status-pill ${doctor.active && doctor.blocks.length ? 'status-pill--completed' : 'status-pill--cancelled'}`}>
                  {!doctor.active ? 'Inhabilitado' : doctor.blocks.length ? 'Recibe citas' : 'Sin agenda'}
                </span>
                {editing !== doctor.id && <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setEditing(doctor.id); setAbsenceFor(null); }}>Editar horario</button>}
                {absenceFor !== doctor.id && doctor.hasProfile ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setAbsenceFor(doctor.id); setEditing(null); }}>Registrar incapacidad</button> : null}
              </div>
            </div>
            {absenceFor === doctor.id && (
              <AbsenceForm
                doctorId={doctor.id}
                doctorName={doctor.name}
                onCancel={() => setAbsenceFor(null)}
                onSaved={data => { setAbsenceFor(null); setNotice(`${doctor.name}: ${absenceResultMessage(data)}`); setAbsenceKey(key => key + 1); load(); }}
              />
            )}
            {editing === doctor.id && (
              <ScheduleEditor
                doctor={doctor}
                isAdmin
                specialties={specialties}
                onCancel={() => setEditing(null)}
                onSaved={() => load()}
              />
            )}
          </article>
        ))}
      </div>
      <h4 className="absence-list__title">Novedades registradas (incapacidades, vacaciones, licencias)</h4>
      <AbsenceList adminMode refreshKey={absenceKey} />
    </>
  );
}

function RolesPanel() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    getRoleUsers().then(data => setUsers(data.items || [])).catch(error => setState({ status: 'error', message: error.message }));
  }, []);

  const toggle = (userId, role) => setUsers(list => list.map(user => {
    if (user.id !== userId) return user;
    return { ...user, roles: user.roles.includes(role) ? user.roles.filter(item => item !== role) : [...user.roles, role], dirty: true };
  }));

  const save = async user => {
    if (!user.roles.length) { setState({ status: 'error', message: 'Cada usuario debe conservar al menos un perfil.' }); return; }
    try {
      await updateUserRoles(user.id, user.roles);
      setUsers(list => list.map(item => (item.id === user.id ? { ...item, dirty: false } : item)));
      setState({ status: 'success', message: `Perfiles actualizados para ${user.name}.` });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  const visible = users.filter(user => `${user.name} ${user.document}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Seguridad</span>
          <h3>Perfiles de acceso</h3>
          <p className="portal-help">Una persona puede tener varios perfiles (por ejemplo, afiliada y médica) con el mismo documento.</p>
        </div>
        <input className="portal-search" placeholder="Buscar por nombre o documento" value={filter} onChange={event => setFilter(event.target.value)} />
      </div>
      {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
      <div className="portal-list">
        {visible.map(user => (
          <article className="role-row" key={user.id}>
            <div><strong>{user.name}</strong><span>CC {user.document} · {user.status}</span></div>
            <div className="role-row__options">
              {ROLE_ORDER.map(role => (
                <label key={role} className={`role-chip role-${role} ${user.roles.includes(role) ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={user.roles.includes(role)} onChange={() => toggle(user.id, role)} />
                  {roleLabel(role)}
                </label>
              ))}
            </div>
            <button type="button" className="btn btn--ghost btn--sm" disabled={!user.dirty} onClick={() => save(user)}>Guardar</button>
          </article>
        ))}
      </div>
    </>
  );
}

export default function AdminPortal() {
  const [tab, setTab] = useState('doctors');
  const [overview, setOverview] = useState(null);

  useEffect(() => { getStaffOverview().then(data => setOverview(data.items)).catch(() => setOverview(null)); }, [tab]);

  return (
    <>
      {overview && (
        <div className="portal-stats">
          <div className="portal-stat"><span>Afiliados</span><strong>{overview.affiliates}</strong></div>
          <div className="portal-stat"><span>Médicos</span><strong>{overview.doctors}</strong></div>
          <div className="portal-stat"><span>Citas activas</span><strong>{overview.activeAppointments}</strong></div>
          <div className="portal-stat"><span>Por reprogramar</span><strong>{overview.toReschedule ?? 0}</strong></div>
          <div className="portal-stat"><span>Autorizaciones pendientes</span><strong>{overview.pendingAuthorizations ?? 0}</strong></div>
          <div className="portal-stat"><span>Laboratorios pendientes</span><strong>{overview.pendingLabs}</strong></div>
          <div className="portal-stat"><span>PQRS abiertas</span><strong>{overview.openPqrs}</strong></div>
        </div>
      )}
      <div className="portal-tabs" role="tablist">
        <button type="button" className={tab === 'doctors' ? 'is-active' : ''} onClick={() => setTab('doctors')}>Médicos y horarios</button>
        <button type="button" className={tab === 'agenda' ? 'is-active' : ''} onClick={() => setTab('agenda')}>Agenda general</button>
        <button type="button" className={tab === 'authorizations' ? 'is-active' : ''} onClick={() => setTab('authorizations')}>Autorizaciones</button>
        <button type="button" className={tab === 'pharmacy' ? 'is-active' : ''} onClick={() => setTab('pharmacy')}>Farmacia</button>
        <button type="button" className={tab === 'pqrs' ? 'is-active' : ''} onClick={() => setTab('pqrs')}>PQRS</button>
        <button type="button" className={tab === 'notifications' ? 'is-active' : ''} onClick={() => setTab('notifications')}>Notificaciones enviadas</button>
        <button type="button" className={tab === 'roles' ? 'is-active' : ''} onClick={() => setTab('roles')}>Perfiles de acceso</button>
      </div>
      {tab === 'notifications' && <NotificationsPanel adminMode />}
      {tab !== 'notifications' && <section className="portal-card">
        {tab === 'doctors' && <DoctorsPanel />}
        {tab === 'agenda' && (
          <>
            <div className="portal-card__head">
              <div><span className="portal-label">Operación</span><h3>Agenda general de citas</h3></div>
              <Link to="/tramites/agendar-cita" className="btn btn--primary btn--sm">Agendar a un afiliado</Link>
            </div>
            <AgendaView adminMode />
          </>
        )}
        {tab === 'authorizations' && <AuthorizationQueue />}
        {tab === 'pharmacy' && <PharmacyQueue />}
        {tab === 'pqrs' && <PqrsQueue />}
        {tab === 'roles' && <RolesPanel />}
      </section>}
    </>
  );
}
