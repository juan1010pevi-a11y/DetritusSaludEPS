import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LineIcon from '../../components/LineIcon/LineIcon';
import { getDashboardSummary, getNews, register } from '../../services/api';
import { DocumentInput, PasswordHints, PasswordInput, PhoneInput } from '../../components/FormFields/FormFields';
import { documentError, emailError, nameError, passwordError, phoneError } from '../../lib/validators';
import { useAuth } from '../../context/AuthContext';
import { ROLES, RoleIcon } from '../../lib/roles';
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

export default function Home() {
  const [news, setNews] = useState([]);
  const { user, role, openLogin } = useAuth();
  const [registerState, setRegisterState] = useState({ status: 'idle', message: '' });
  const [registerPassword, setRegisterPassword] = useState('');
  const [dashboard, setDashboard] = useState({ appointments: [], pqrs: [], authorizations: [] });

  useEffect(() => {
    getNews().then(data => setNews(data.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id || role !== 'affiliate') return;
    getDashboardSummary()
      .then(data => setDashboard(data))
      .catch(() => setDashboard({ appointments: [], pqrs: [], authorizations: [] }));
  }, [user, role]);

  const handleRegister = async event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      name: String(form.get('name') || '').trim(),
      document: String(form.get('document') || '').trim(),
      password: form.get('password'),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      whatsappOptIn: form.get('whatsapp') === 'on',
      plan: 'contributivo',
    };
    const problem = nameError(payload.name) || documentError(payload.document) || emailError(payload.email) || phoneError(payload.phone) || passwordError(payload.password);
    if (problem) { setRegisterState({ status: 'error', message: problem }); return; }
    setRegisterState({ status: 'loading', message: '' });
    try {
      const data = await register(payload);
      formElement.reset();
      setRegisterPassword('');
      setRegisterState({
        status: 'success',
        message: data.linked
          ? `Listo, ${data.name}: tu afiliación quedó vinculada a tu cuenta de médico. Ingresa con el mismo documento y cambia de perfil desde el menú.`
          : `Cuenta creada para ${data.name}. Ya puedes ingresar.`,
      });
      openLogin({ role: 'affiliate' });
    } catch (error) {
      setRegisterState({
        status: 'error',
        message: error.status === 409 ? error.message : (error.message || 'No fue posible crear la cuenta.'),
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
          {user ? (
            <div className={`portal__dashboard portal__dashboard--compact role-${role}`}>
              <span className="section-label">{ROLES[role].portalTitle}</span>
              <h2 className="section-heading">Hola, {user.name}</h2>
              <span className="role-badge"><RoleIcon role={role} /> {ROLES[role].label}</span>
              <p className="portal__sub">{ROLES[role].description}</p>
              {role === 'affiliate' && (
                <div className="portal__row">
                  <div className="portal__mini-card"><span className="portal__mini-label">Citas</span><strong>{dashboard.appointments.length}</strong><small>Registradas</small></div>
                  <div className="portal__mini-card"><span className="portal__mini-label">PQRS</span><strong>{dashboard.pqrs.length}</strong><small>En total</small></div>
                  <div className="portal__mini-card portal__mini-card--wide"><span className="portal__mini-label">Autorizaciones</span><strong>{dashboard.authorizations.length}</strong><small>Activas o historial</small></div>
                </div>
              )}
              <div className="portal__actions">
                <Link to="/portal" className="btn btn--primary portal__action-btn">Ir a {ROLES[role].portalTitle.toLowerCase()}</Link>
                {role === 'affiliate' && <Link to="/tramites/agendar-cita" className="btn btn--ghost portal__action-btn">Agendar cita</Link>}
                {role === 'affiliate' && <Link to="/afiliados/resultados-laboratorio" className="btn btn--ghost portal__action-btn">Resultados</Link>}
              </div>
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
                <button type="button" className="btn btn--ghost portal__login-cta" onClick={() => openLogin()}>Ya tengo cuenta · Ingresar</button>

              </div>

              <div className="portal__form portal__form--register">
                <h3>Crea tu cuenta</h3>
                <p className="portal__register-lead">Regístrate con tu documento. Si ya tienes cuenta, usa el botón <strong>Ingresar</strong> de la parte superior.</p>
                <form onSubmit={handleRegister} className="portal__register-form">
                  <div className="form-row compact-row">
                    <div className="form-group"><label htmlFor="home-name">Nombre completo</label><input id="home-name" name="name" type="text" placeholder="Tu nombre" maxLength={120} required /></div>
                    <div className="form-group"><label htmlFor="home-document">Documento</label><DocumentInput id="home-document" name="document" required /></div>
                  </div>
                  <div className="form-row compact-row">
                    <div className="form-group"><label htmlFor="home-email">Correo</label><input id="home-email" name="email" type="email" placeholder="correo@ejemplo.com" maxLength={120} required /></div>
                    <div className="form-group"><label htmlFor="home-phone">Celular</label><PhoneInput id="home-phone" name="phone" required /></div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="home-password">Contraseña</label>
                    <PasswordInput id="home-password" name="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres, letras y números" minLength={8} required
                      value={registerPassword} onChange={event => setRegisterPassword(event.target.value)} />
                    <PasswordHints value={registerPassword} />
                  </div>
                  <label className="portal__optin"><input type="checkbox" name="whatsapp" defaultChecked /> Quiero recibir avisos por WhatsApp además de correo y SMS</label>
                  <button className="btn btn--primary portal__submit" disabled={registerState.status === 'loading'}>{registerState.status === 'loading' ? 'Creando...' : 'Crear cuenta'}</button>
                </form>
                {registerState.message && <p className={`portal__message form-status--${registerState.status}`} role="status">{registerState.message}</p>}
                <p className="portal__register-note">¿Eres médico de la red Detritus? Regístrate con tu mismo documento y la contraseña con la que ingresas como médico: vinculamos tu afiliación a esa cuenta, sin crear otra.</p>
              </div>
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
