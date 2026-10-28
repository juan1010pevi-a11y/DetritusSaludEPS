import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { initials, ROLE_ORDER, ROLES, RoleIcon } from '../../lib/roles';
import './Navbar.css';

const NAV = [
  { id:'afiliados', label:'Afiliados', path:'/afiliados', children:[
    { label:'Rutas de atención', path:'/afiliados/rutas-atencion' },
    { label:'Madres gestantes', path:'/afiliados/madres-gestantes' },
    { label:'Preguntas frecuentes', path:'/afiliados/preguntas-frecuentes' },
    { label:'Medicamentos', path:'/afiliados/medicamentos' },
    { label:'Resultados de laboratorio', path:'/afiliados/resultados-laboratorio' },
    { label:'Medicina domiciliaria', path:'/afiliados/medicina-domiciliaria' },
    { label:'Régimen sub. y contrib.', path:'/afiliados/regimen' },
    { label:'Requisitos de afiliación', path:'/afiliados/requisitos' },
    { label:'Copagos y cuotas', path:'/afiliados/copagos' },
    { label:'Plan de beneficios', path:'/afiliados/plan-beneficios' },
    { label:'Puntos de atención', path:'/afiliados/puntos-atencion' },
    { label:'Consulta tu IPS', path:'/afiliados/consulta-ips' },
  ]},
  { id:'tramites', label:'Trámites en línea', path:'/tramites', children:[
    { label:'Afiliación subsidiado', path:'/tramites/afiliacion-subsidiado' },
    { label:'Afiliación contributivo', path:'/tramites/afiliacion-contributivo' },
    { label:'Consulta de afiliados', path:'/tramites/consulta-afiliados' },
    { label:'Certificado de afiliación', path:'/tramites/certificado' },
    { label:'Solicitud de portabilidad', path:'/tramites/portabilidad' },
    { label:'Actualiza tus datos', path:'/tramites/actualiza-datos' },
    { label:'Consulta autorizaciones', path:'/tramites/autorizaciones' },
    { label:'Agendar cita', path:'/tramites/agendar-cita' },
    { label:'Asignación EPS — MinSalud', path:'/tramites/asignacion-eps' },
    { label:'Estado de PQRSD', path:'/tramites/estado-pqrsd' },
    { label:'Radicar PQRSD', path:'/tramites/radicar-pqrsd' },
  ]},
  { id:'atencion', label:'Atención al usuario', path:'/atencion' },
  { id:'nosotros', label:'Nosotros', path:'/nosotros', children:[
    { label:'Historia', path:'/nosotros/historia' },
    { label:'Misión y visión', path:'/nosotros/mision-vision' },
    { label:'Objetivos estratégicos', path:'/nosotros/objetivos' },
    { label:'Valores', path:'/nosotros/valores' },
    { label:'Trabaja con nosotros', path:'/nosotros/trabaja' },
  ]},
];

function UserMenu() {
  const { user, role, roles, switchRole, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const close = event => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const changeRole = async next => {
    setError('');
    try {
      await switchRole(next);
      setOpen(false);
      navigate('/portal');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`user-menu role-${role}`} ref={ref}>
      <button type="button" className="user-menu__trigger" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="user-menu__avatar">{initials(user.name)}<span className="user-menu__avatar-icon"><RoleIcon role={role} /></span></span>
        <span className="user-menu__text">
          <strong>{user.name}</strong>
          <span className="role-badge">{ROLES[role].label}</span>
        </span>
        <span className="nav-chevron">▾</span>
      </button>
      {open && (
        <div className="user-menu__dropdown">
          <div className="user-menu__head">
            <strong>{user.name}</strong>
            <span>Documento {user.document}</span>
            {user.doctor && role === 'doctor' && <span>{user.doctor.specialty}</span>}
          </div>
          <Link to="/portal" className="user-menu__item" onClick={() => setOpen(false)}>Ir a {ROLES[role].portalTitle.toLowerCase()}</Link>
          {roles.length > 1 && (
            <div className="user-menu__switch">
              <span className="user-menu__label">Cambiar de perfil</span>
              {ROLE_ORDER.filter(item => roles.includes(item)).map(item => (
                <button key={item} type="button" disabled={item === role} className={`user-menu__role role-${item}`} onClick={() => changeRole(item)}>
                  <RoleIcon role={item} /> {ROLES[item].label} {item === role && <small>(actual)</small>}
                </button>
              ))}
            </div>
          )}
          {error && <p className="user-menu__error">{error}</p>}
          <button type="button" className="user-menu__item user-menu__logout" onClick={() => { logout(); setOpen(false); navigate('/'); }}>Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, role, openLogin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDrop, setOpenDrop] = useState(null);

  const toggleMenu = () => { setMenuOpen(!menuOpen); setOpenDrop(null); };
  const toggleDrop = (id) => setOpenDrop(openDrop === id ? null : id);

  return (
    <header>
      <div className="topbar">
        <span className="topbar__info">Bogotá, D.C. · Lun–Vie 7am–7pm · Sáb 8am–2pm</span>
        <div className="topbar__links">
          <Link to="/tramites/estado-pqrsd">PQRS</Link>
          <Link to="/nosotros/trabaja">Trabaja con nosotros</Link>
          <a href="https://www.supersalud.gov.co" target="_blank" rel="noopener noreferrer">Supersalud ↗</a>
          <span className="topbar__urgency">Línea nacional 018000 123 456</span>
        </div>
      </div>

      <nav className={`navbar ${user ? `navbar--session role-${role}` : ''}`}>
        <div className="navbar__inner container">
          <Link to="/" className="navbar__logo">
            <div className="navbar__logo-wrap">
              <img src="/logo.png" alt="Detritus Salud E.P.S." onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
              <div className="navbar__logo-fallback">➕</div>
            </div>
            <div className="navbar__brand">
              <span className="navbar__brand-name">Detritus Salud</span>
              <span className="navbar__brand-tag">E.P.S.</span>
            </div>
          </Link>

          <ul className={`navbar__links ${menuOpen ? 'open' : ''}`}>
            <li className="nav-item"><NavLink to="/" end className={({isActive})=>isActive?'nav-link active':'nav-link'} onClick={()=>setMenuOpen(false)}>Inicio</NavLink></li>
            {NAV.map(item => (
              <li key={item.id} className={`nav-item ${item.children ? 'nav-item--has-drop' : ''} ${openDrop===item.id?'drop-open':''}`}>
                <NavLink to={item.path} className={({isActive})=>isActive?'nav-link active':'nav-link'} onClick={e => { if(item.children && window.innerWidth<=960){ e.preventDefault(); toggleDrop(item.id); } else { setMenuOpen(false); }}}>
                  {item.label} {item.children && <span className="nav-chevron">▾</span>}
                </NavLink>
                {item.children && (
                  <div className="nav-dropdown">
                    {item.children.map(c => (
                      <Link key={c.path} to={c.path} className="nav-dropdown__item" onClick={()=>setMenuOpen(false)}>{c.label}</Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="navbar__actions">
            {user ? <UserMenu /> : (
              <>
                <button type="button" className="btn btn--ghost btn--sm navbar__login" onClick={() => openLogin()}>Ingresar</button>
                <Link to="/afiliarme" className="btn btn--primary btn--sm navbar__join">Afiliarme</Link>
              </>
            )}
          </div>

          <button className={`navbar__hamburger ${menuOpen?'active':''}`} onClick={toggleMenu} aria-label="Menú">
            <span /><span /><span />
          </button>
        </div>
      </nav>
      {user && (
        <div className={`session-band role-${role}`}>
          <div className="container session-band__inner">
            <RoleIcon role={role} />
            <span>Sesión activa como <strong>{ROLES[role].label}</strong></span>
            <span className="session-band__sep">·</span>
            <span className="session-band__name">{user.name}{role === 'doctor' && user.doctor?.specialty ? ` · ${user.doctor.specialty}` : ''}</span>
            <Link to="/portal" className="session-band__link">{ROLES[role].portalTitle} →</Link>
          </div>
        </div>
      )}
    </header>
  );
}
