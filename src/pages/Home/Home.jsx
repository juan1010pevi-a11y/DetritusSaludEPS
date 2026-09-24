import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LineIcon from '../../components/LineIcon/LineIcon';
import { getDashboardSummary, getNews, getRoleUsers, getStaffOverview, login, register, updateUserRoles } from '../../services/api';
import './Home.css';

const quickLinks = [
  { icon: 'lab', label: 'Resultados lab.', detail: 'Tus resultados', to: '/afiliados/resultados-laboratorio' },
  { icon: 'pill', label: 'Medicamentos', detail: 'Fórmulas y entregas', to: '/afiliados/medicamentos' },
  { icon: 'card', label: 'Carné digital', detail: 'Llévalo contigo', to: '/tramites/certificado' },
  { icon: 'document', label: 'Radicar PQRS', detail: 'Estamos para ayudarte', to: '/tramites/radicar-pqrsd' },
];

function QuickIcon({ name }) {
  const paths = {
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>,
    lab: <><path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.8 3h6.4a2 2 0 0 0 1.8-3l-5-9V3" /><path d="M7.5 15h9" /></>,
    pill: <><path d="M7 17 17 7a3.5 3.5 0 0 0-5-5L2 12a3.5 3.5 0 0 0 5 5Z" /><path d="m5 9 5 5" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M13 10h5M13 14h4" /></>,
    document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4M9 13h6M9 17h4" /></>,
  };
  return <svg className="quick-card__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function formatDate(value) {
  if (!value) return 'Fecha pendiente';
  const date = new Date(`${value}${value.length === 10 ? 'T00:00:00' : ''}`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date);
}

function statusLabel(value) {
  const labels = {
    requested: 'Solicitada',
    received: 'Recibida',
    pending: 'Pendiente',
    approved: 'Aprobada',
    active: 'Activa',
    closed: 'Cerrada',
  };
  return labels[value] || value || 'Sin estado';
}

function roleLabel(value) {
  return { affiliate: 'Afiliado', doctor: 'Médico', administrator: 'Administrador' }[value] || value;
}

const availableRoles = ['affiliate', 'doctor', 'administrator'];

export default function Home() {
  const [news, setNews] = useState([]);
  const [loginState, setLoginState] = useState({ status: 'idle', message: '' });
  const [registerState, setRegisterState] = useState({ status: 'idle', message: '' });
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [dashboard, setDashboard] = useState({ appointments: [], pqrs: [], authorizations: [] });
  const [staffOverview, setStaffOverview] = useState(null);
  const [roleUsers, setRoleUsers] = useState([]);
  const [rolesState, setRolesState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    getNews().then(data => setNews(data.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    getDashboardSummary(session.user.id)
      .then(data => setDashboard(data))
      .catch(() => setDashboard({ appointments: [], pqrs: [], authorizations: [] }));
  }, [session]);

  useEffect(() => {
    if (session?.user?.role !== 'administrator') {
      setRoleUsers([]);
      return;
    }
    getRoleUsers().then(data => setRoleUsers(data.items || [])).catch(() => {
      setRolesState({ status: 'error', message: 'No fue posible cargar los usuarios.' });
    });
  }, [session]);

  useEffect(() => {
    if (!session?.user?.role || session.user.role === 'affiliate') {
      setStaffOverview(null);
      return;
    }
    getStaffOverview().then(data => setStaffOverview(data.items)).catch(() => setStaffOverview(null));
  }, [session]);

  const handleLogin = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoginState({ status: 'loading', message: '' });
    try {
      const data = await login(form.get('document'), form.get('password'), form.get('role'));
      const nextSession = { token: data.token, user: data.user };
      localStorage.setItem('token', data.token);
      localStorage.setItem('session', JSON.stringify(nextSession));
      setSession(nextSession);
      setLoginState({ status: 'success', message: `Bienvenido, ${data.user.name}` });
    } catch {
      setLoginState({ status: 'error', message: 'No fue posible iniciar sesión. Verifica tus datos y que Auth Service esté activo.' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('session');
    setSession(null);
    setLoginState({ status: 'idle', message: '' });
  };

  const toggleRole = (userId, role) => {
    setRoleUsers(users => users.map(user => {
      if (user.id !== userId) return user;
      const roles = user.roles.includes(role)
        ? user.roles.filter(item => item !== role)
        : [...user.roles, role];
      return { ...user, roles };
    }));
  };

  const handleRoleSave = async user => {
    if (!user.roles.length) {
      setRolesState({ status: 'error', message: 'Cada usuario debe conservar al menos un rol.' });
      return;
    }
    setRolesState({ status: 'loading', message: '' });
    try {
      await updateUserRoles(user.id, user.roles);
      setRolesState({ status: 'success', message: `Roles actualizados para ${user.name}.` });
    } catch {
      setRolesState({ status: 'error', message: 'No fue posible guardar los roles.' });
    }
  };

  const handleRegister = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setRegisterState({ status: 'loading', message: '' });
    try {
      const data = await register({
        name: form.get('name'),
        document: form.get('document'),
        password: form.get('password'),
        email: form.get('email'),
        phone: form.get('phone'),
        plan: 'contributivo',
      });
      event.currentTarget.reset();
      setRegisterState({ status: 'success', message: `Cuenta creada para ${data.name}. Ya puedes iniciar sesión.` });
    } catch (error) {
      setRegisterState({
        status: 'error',
        message: error.message.includes('409') ? 'Ese documento ya está registrado.' : 'No fue posible crear la cuenta.',
      });
    }
  };

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero__arc" />
        <div className="hero__inner container">
          <div className="hero__text">
            <p className="hero__eyebrow">Tu salud, nuestra prioridad</p>
            <h1 className="hero__title">Cuidamos cada etapa<br />de <em>tu vida</em></h1>
            <p className="hero__sub">Más de 800 IPS aliadas, especialistas y medicamentos en todo el territorio nacional.</p>
            <div className="hero__stats">
              <div className="hero__stat"><strong>800+</strong><span>IPS aliadas</span></div>
              <div className="hero__divider" />
              <div className="hero__stat"><strong>1.2M</strong><span>Afiliados</span></div>
              <div className="hero__divider" />
              <div className="hero__stat"><strong>32</strong><span>Departamentos</span></div>
            </div>
            <div className="hero__ctas">
              <Link to="/tramites/agendar-cita" className="btn btn--gold"><LineIcon name="calendar" /> Agendar cita</Link>
              <Link to="/tramites/autorizaciones" className="btn btn--ghost-white">Consultar autorización</Link>
            </div>
          </div>
          <div className="hero__visual">
            <div className="hero__ring">
              <img src="/logo.png" alt="" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
              <div className="hero__ring-fb" style={{display:'none'}}>➕</div>
            </div>
          </div>
        </div>
      </section>

      {/* ACCESOS RÁPIDOS */}
      <section className="quick">
        <div className="container">
          <span className="section-label">Acceso directo</span>
          <h2 className="section-heading">¿Qué necesitas hoy?</h2>
          <div className="quick-grid">
            {quickLinks.map(q => (
              <Link key={q.label} to={q.to} className="quick-card">
                <div className="quick-card__icon"><QuickIcon name={q.icon} /></div>
                <span className="quick-card__label">{q.label}</span>
                <span className="quick-card__detail">{q.detail}</span>
                <span className="quick-card__arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PORTAL */}
      <section className="portal">
        <div className="container portal__inner">
          {session ? (
            <div className="portal__dashboard">
              <span className="section-label">Portal del afiliado</span>
              <h2 className="section-heading">Hola, {session.user.name}</h2>
              <span className="portal__role-badge">{roleLabel(session.user.role)}</span>
              <p className="portal__sub">Tus servicios de salud en un solo lugar. Agenda, consulta y gestiona tus trámites desde aquí.</p>

              {staffOverview && <div className="portal__staff-overview">
                <div><span>Perfil operativo</span><strong>{session.user.role === 'doctor' ? 'Médico' : 'Administrador'}</strong></div>
                <div><span>Afiliados</span><strong>{staffOverview.affiliates}</strong></div>
                <div><span>Citas activas</span><strong>{staffOverview.activeAppointments}</strong></div>
                <div><span>PQRS abiertas</span><strong>{staffOverview.openPqrs}</strong></div>
              </div>}

              <div className="portal__row">
                <div className="portal__mini-card">
                  <span className="portal__mini-label">Citas</span>
                  <strong>{dashboard.appointments.length}</strong>
                  <small>Registradas</small>
                </div>
                <div className="portal__mini-card">
                  <span className="portal__mini-label">PQRS</span>
                  <strong>{dashboard.pqrs.length}</strong>
                  <small>En total</small>
                </div>
                <div className="portal__mini-card portal__mini-card--wide">
                  <span className="portal__mini-label">Autorizaciones</span>
                  <strong>{dashboard.authorizations.length}</strong>
                  <small>Activas o historial</small>
                </div>
              </div>

              <div className="portal__status-list">
                {dashboard.appointments.length ? (
                  <div className="portal__status-item">
                    <span>Última cita</span>
                    <strong>{dashboard.appointments[0].specialty}</strong>
                    <small>{dashboard.appointments[0].date}</small>
                  </div>
                ) : (
                  <div className="portal__status-item portal__status-item--empty">
                    <span>Última cita</span>
                    <strong>No registra citas</strong>
                    <small>Agenda una para comenzar</small>
                  </div>
                )}

                {dashboard.pqrs.length ? (
                  <div className="portal__status-item">
                    <span>Última PQRS</span>
                    <strong>{dashboard.pqrs[0].type}</strong>
                    <small>{dashboard.pqrs[0].status}</small>
                  </div>
                ) : (
                  <div className="portal__status-item portal__status-item--empty">
                    <span>Última PQRS</span>
                    <strong>No hay solicitudes</strong>
                    <small>Aún no se registra ninguna</small>
                  </div>
                )}
              </div>

              <div className="portal__details">
                <section className="portal__detail-section" aria-labelledby="appointments-title">
                  <div className="portal__detail-heading">
                    <div>
                      <span className="portal__mini-label">Historial</span>
                      <h3 id="appointments-title">Mis citas</h3>
                    </div>
                    <span className="portal__detail-count">{dashboard.appointments.length}</span>
                  </div>
                  {dashboard.appointments.length ? (
                    <div className="portal__detail-list">
                      {dashboard.appointments.map(appointment => (
                        <article className="portal__detail-item" key={appointment.id}>
                          <div className="portal__detail-item-main">
                            <strong>{appointment.specialty}</strong>
                            <span>{formatDate(appointment.date)}</span>
                          </div>
                          <span className={`portal__status-pill portal__status-pill--${appointment.status}`}>
                            {statusLabel(appointment.status)}
                          </span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="portal__empty-detail">Todavía no tienes citas registradas.</p>
                  )}
                </section>

                <section className="portal__detail-section" aria-labelledby="pqrs-title">
                  <div className="portal__detail-heading">
                    <div>
                      <span className="portal__mini-label">Seguimiento</span>
                      <h3 id="pqrs-title">Mis PQRS</h3>
                    </div>
                    <span className="portal__detail-count">{dashboard.pqrs.length}</span>
                  </div>
                  {dashboard.pqrs.length ? (
                    <div className="portal__detail-list">
                      {dashboard.pqrs.map(request => (
                        <article className="portal__detail-item portal__detail-item--stacked" key={request.id}>
                          <div className="portal__detail-item-main">
                            <strong>{request.type}</strong>
                            <span>{formatDate(request.createdAt)}</span>
                          </div>
                          <span className={`portal__status-pill portal__status-pill--${request.status}`}>
                            {statusLabel(request.status)}
                          </span>
                          <p>{request.description}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="portal__empty-detail">Todavía no tienes PQRS registradas.</p>
                  )}
                </section>
              </div>

              <div className="portal__actions">
                <Link to="/tramites/agendar-cita" className="btn btn--primary portal__action-btn">Agendar cita</Link>
                <Link to="/tramites/radicar-pqrsd" className="btn btn--ghost portal__action-btn">Radicar PQRS</Link>
                <Link to="/tramites/autorizaciones" className="btn btn--ghost portal__action-btn">Autorizaciones</Link>
              </div>

              {session.user.role === 'administrator' && (
                <section className="portal__roles-panel" aria-labelledby="roles-title">
                  <div className="portal__detail-heading">
                    <div>
                      <span className="portal__mini-label">Administración</span>
                      <h3 id="roles-title">Perfiles de acceso</h3>
                    </div>
                  </div>
                  <p className="portal__roles-help">Una persona puede tener varios perfiles sin duplicar su documento.</p>
                  <div className="portal__roles-list">
                    {roleUsers.map(user => (
                      <article className="portal__role-item" key={user.id}>
                        <div className="portal__role-user">
                          <strong>{user.name}</strong>
                          <span>{user.document} · {user.status}</span>
                        </div>
                        <div className="portal__role-options">
                          {availableRoles.map(role => (
                            <label key={role}>
                              <input
                                type="checkbox"
                                checked={user.roles.includes(role)}
                                onChange={() => toggleRole(user.id, role)}
                              />
                              {roleLabel(role)}
                            </label>
                          ))}
                        </div>
                        <button className="btn btn--ghost portal__role-save" type="button" onClick={() => handleRoleSave(user)}>
                          Guardar roles
                        </button>
                      </article>
                    ))}
                  </div>
                  {rolesState.message && <p className="portal__message" role="status">{rolesState.message}</p>}
                </section>
              )}

              <button className="portal__logout" type="button" onClick={handleLogout}>Cerrar sesión</button>
            </div>
          ) : (
            <>
              <div className="portal__copy">
                <span className="section-label">Portal del afiliado</span>
                <h2 className="section-heading">Tu salud,<br/>en un solo lugar</h2>
                <p className="portal__sub">Agenda citas, consulta autorizaciones, descarga tu carné y revisa resultados desde tu cuenta.</p>
                <ul className="portal__features">
                  <li>Agenda citas 24/7</li>
                  <li>Descarga tu carné digital</li>
                  <li>Consulta autorizaciones</li>
                  <li>Revisa resultados de laboratorio</li>
                </ul>

                <div className="portal__register-panel">
                  <p className="portal__register-lead">¿Aún no tienes cuenta?</p>
                  <form onSubmit={handleRegister} className="portal__register-form">
                    <div className="form-row compact-row">
                      <div className="form-group"><label>Nombre</label><input name="name" type="text" placeholder="Tu nombre" required /></div>
                      <div className="form-group"><label>Documento</label><input name="document" type="text" placeholder="1020304050" required /></div>
                    </div>
                    <div className="form-row compact-row">
                      <div className="form-group"><label>Correo</label><input name="email" type="email" placeholder="correo@ejemplo.com" /></div>
                      <div className="form-group"><label>Teléfono</label><input name="phone" type="tel" placeholder="3001234567" /></div>
                    </div>
                    <div className="form-group"><label>Contraseña</label><input name="password" type="password" placeholder="Mínimo 6 caracteres" minLength="6" required /></div>
                    <button className="btn btn--ghost portal__register-submit" disabled={registerState.status === 'loading'}>{registerState.status === 'loading' ? 'Creando...' : 'Crear cuenta'}</button>
                  </form>
                  {registerState.message && <p className="portal__message" role="status">{registerState.message}</p>}
                </div>
              </div>

              <form className="portal__form" onSubmit={handleLogin}>
                <h3>Ingresa a tu cuenta</h3>
                <div className="form-group"><label htmlFor="login-role">Ingresa como</label><select id="login-role" name="role" defaultValue="affiliate" required><option value="affiliate">Afiliado</option><option value="doctor">Médico</option><option value="administrator">Administrador</option></select></div>
                <div className="form-group"><label>Número de documento</label><input name="document" type="text" placeholder="Ej. 1020304050" required /></div>
                <div className="form-group"><label style={{display:'flex',justifyContent:'space-between'}}><span>Contraseña</span><Link to="/atencion" className="portal__recover">¿Olvidaste la tuya?</Link></label><input name="password" type="password" placeholder="••••••••" required /></div>
                <button className="btn btn--primary portal__submit" disabled={loginState.status === 'loading'}>{loginState.status === 'loading' ? 'Ingresando...' : 'Ingresar al portal'}</button>
                {loginState.message && <p className="portal__footer" role="status">{loginState.message}</p>}
                <p className="portal__footer">¿No tienes cuenta? <Link to="/tramites/afiliacion-contributivo">Regístrate gratis</Link></p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* NOTICIAS */}
      <section className="news">
        <div className="container">
          <div className="news__header"><div><span className="section-label">Información y salud</span><h2 className="section-heading">Últimas noticias</h2></div></div>
          <div className="news-grid">
            {(news.length ? news : [{icon:'vaccine',tag:'Campaña',title:'Jornada de vacunación contra la influenza 2026',date:'18 ago 2026'},{icon:'brain',tag:'Bienestar',title:'Recursos de salud mental disponibles para ti',date:'15 ago 2026'},{icon:'card',tag:'Novedades',title:'Nueva app con telemedicina integrada',date:'10 ago 2026'}]).map((n,i)=>(
              <Link key={n.id || i} to={n.id ? `/noticias/${n.id}` : '/'} className="news-card">
                <div className="news-card__thumb">
                  {n.image ? <img src={n.image} alt="" /> : <LineIcon name={n.icon} />}
                </div>
                <div className="news-card__body">
                  <span className="news-card__tag">{n.tag}</span>
                  <h3 className="news-card__title">{n.title}</h3>
                  <p className="news-card__excerpt">{n.body}</p>
                  <div className="news-card__meta"><time>{n.date || n.publishedAt}</time></div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
