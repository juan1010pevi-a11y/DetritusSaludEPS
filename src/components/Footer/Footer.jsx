import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div className="footer__brand">
          <Link to="/" className="footer__logo">
            <div className="footer__logo-wrap">
              <img src="/logo.png" alt="Detritus Salud" onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex'}} />
              <div className="footer__logo-fb" style={{display:'none'}}>➕</div>
            </div>
            <div><span className="footer__brand-name">Detritus Salud</span><span className="footer__brand-tag">E.P.S.</span></div>
          </Link>
          <p className="footer__desc">Comprometidos con la salud integral de los colombianos.<br/>Vigilados por la Superintendencia Nacional de Salud.</p>
        </div>
        <div className="footer__col"><h4>Afiliados</h4><ul>
          <li><Link to="/afiliados/rutas-atencion">Rutas de atención</Link></li>
          <li><Link to="/afiliados/medicamentos">Medicamentos</Link></li>
          <li><Link to="/afiliados/plan-beneficios">Plan de beneficios</Link></li>
          <li><Link to="/afiliados/puntos-atencion">Puntos de atención</Link></li>
        </ul></div>
        <div className="footer__col"><h4>Trámites</h4><ul>
          <li><Link to="/tramites/autorizaciones">Autorizaciones</Link></li>
          <li><Link to="/tramites/certificado">Certificado</Link></li>
          <li><Link to="/tramites/actualiza-datos">Actualiza datos</Link></li>
          <li><Link to="/tramites/estado-pqrsd">PQRSD</Link></li>
        </ul></div>
        <div className="footer__col"><h4>Institución</h4><ul>
          <li><Link to="/nosotros/historia">Historia</Link></li>
          <li><Link to="/nosotros/mision-vision">Misión y visión</Link></li>
          <li><Link to="/nosotros/trabaja">Trabaja con nosotros</Link></li>
          <li><Link to="/atencion">Contáctenos</Link></li>
        </ul></div>
      </div>
      <div className="footer__regulators container">
        <span className="footer__reg-label">Entidades reguladoras</span>
        <div className="footer__reg-logos">
          <a href="https://www.supersalud.gov.co" target="_blank" rel="noopener noreferrer" className="footer__reg-badge">Supersalud</a>
          <a href="https://www.minsalud.gov.co" target="_blank" rel="noopener noreferrer" className="footer__reg-badge">MinSalud</a>
          <a href="https://www.adres.gov.co" target="_blank" rel="noopener noreferrer" className="footer__reg-badge">ADRES</a>
        </div>
      </div>
      <div className="footer__bottom"><div className="container footer__bottom-inner">
        <span>© {new Date().getFullYear()} Detritus Salud E.P.S. · NIT 900.000.000-0</span>
        <nav className="footer__legal"><Link to="/">Privacidad</Link><Link to="/">Términos</Link></nav>
      </div></div>
    </footer>
  );
}
