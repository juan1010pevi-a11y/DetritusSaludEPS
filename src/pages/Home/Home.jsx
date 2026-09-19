import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LineIcon from '../../components/LineIcon/LineIcon';
import { getNews, login } from '../../services/api';
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
  const [loginState, setLoginState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    getNews().then(data => setNews(data.items || [])).catch(() => {});
  }, []);

  const handleLogin = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoginState({ status: 'loading', message: '' });
    try {
      const data = await login(form.get('document'), form.get('password'));
      localStorage.setItem('token', data.token);
      setLoginState({ status: 'success', message: `Bienvenido, ${data.user.name}` });
    } catch {
      setLoginState({ status: 'error', message: 'No fue posible iniciar sesión. Verifica tus datos y que Auth Service esté activo.' });
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
            <Link to="/tramites/afiliacion-contributivo" className="btn btn--ghost">Crear cuenta gratis →</Link>
          </div>
          <form className="portal__form" onSubmit={handleLogin}>
            <h3>Ingresa a tu cuenta</h3>
            <div className="form-group"><label>Número de documento</label><input name="document" type="text" placeholder="Ej. 1020304050" required /></div>
            <div className="form-group"><label style={{display:'flex',justifyContent:'space-between'}}><span>Contraseña</span><Link to="/atencion" className="portal__recover">¿Olvidaste la tuya?</Link></label><input name="password" type="password" placeholder="••••••••" required /></div>
            <button className="btn btn--primary portal__submit" disabled={loginState.status === 'loading'}>{loginState.status === 'loading' ? 'Ingresando...' : 'Ingresar al portal'}</button>
            {loginState.message && <p className="portal__footer" role="status">{loginState.message}</p>}
            <p className="portal__footer">¿No tienes cuenta? <Link to="/tramites/afiliacion-contributivo">Regístrate gratis</Link></p>
          </form>
        </div>
      </section>

      {/* NOTICIAS */}
      <section className="news">
        <div className="container">
          <div className="news__header"><div><span className="section-label">Información y salud</span><h2 className="section-heading">Últimas noticias</h2></div></div>
          <div className="news-grid">
            {(news.length ? news : [{icon:'vaccine',tag:'Campaña',title:'Jornada de vacunación contra la influenza 2026',date:'18 ago 2026'},{icon:'brain',tag:'Bienestar',title:'Recursos de salud mental disponibles para ti',date:'15 ago 2026'},{icon:'card',tag:'Novedades',title:'Nueva app con telemedicina integrada',date:'10 ago 2026'}]).map((n,i)=>(
              <div key={i} className="news-card">
                <div className="news-card__thumb"><LineIcon name={n.icon} /></div>
                <div className="news-card__body">
                  <span className="news-card__tag">{n.tag}</span>
                  <h3 className="news-card__title">{n.title}</h3>
                  <div className="news-card__meta"><time>{n.date}</time></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
