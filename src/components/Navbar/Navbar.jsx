import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
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

export default function Navbar() {
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

      <nav className="navbar">
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
            <Link to="/afiliados/requisitos" className="btn btn--ghost btn--sm">Ingresar</Link>
            <Link to="/afiliados/requisitos" className="btn btn--primary btn--sm">Afiliarme</Link>
          </div>

          <button className={`navbar__hamburger ${menuOpen?'active':''}`} onClick={toggleMenu} aria-label="Menú">
            <span /><span /><span />
          </button>
        </div>
      </nav>
    </header>
  );
}
