import { Link } from 'react-router-dom';
import './Afiliados.css';

const services = [
  { icon:'route', title:'Rutas de atención', desc:'Procesos de atención para cada servicio de salud.', to:'/afiliados/rutas-atencion', size:'big' },
  { icon:'pill', title:'Medicamentos', desc:'Entrega y consulta de medicamentos PBS.', to:'/afiliados/medicamentos' },
  { icon:'benefits', title:'Plan de beneficios', desc:'Servicios cubiertos por tu afiliación.', to:'/afiliados/plan-beneficios' },
  { icon:'document', title:'Requisitos de afiliación', desc:'Documentos necesarios para afiliarte.', to:'/afiliados/requisitos', size:'big' },
  { icon:'pin', title:'Puntos de atención', desc:'Oficinas en todo el país.', to:'/afiliados/puntos-atencion' },
  { icon:'care', title:'Madres gestantes', desc:'Atención prioritaria sin costo.', to:'/afiliados/madres-gestantes' },
  { icon:'card', title:'Copagos y cuotas', desc:'Tarifas según tu régimen.', to:'/afiliados/copagos' },
  { icon:'compare', title:'Régimen sub. y contrib.', desc:'Diferencias entre regímenes.', to:'/afiliados/regimen' },
  { icon:'home', title:'Medicina domiciliaria', desc:'Atención médica en tu hogar.', to:'/afiliados/medicina-domiciliaria' },
  { icon:'search', title:'Consulta tu IPS', desc:'Busca tu IPS asignada.', to:'/afiliados/consulta-ips' },
  { icon:'help', title:'Preguntas frecuentes', desc:'Resolvemos tus dudas.', to:'/afiliados/preguntas-frecuentes' },
];

function ServiceIcon({ name }) {
  const paths = {
    route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3v-3a3 3 0 0 1 3-3h1" /></>,
    pill: <><path d="M7 17 17 7a3.5 3.5 0 0 0-5-5L2 12a3.5 3.5 0 0 0 5 5Z" /><path d="m5 9 5 5" /></>,
    benefits: <><path d="M12 21s8-3.8 8-10V5l-8-3-8 3v6c0 6.2 8 10 8 10Z" /><path d="M9 12h6M12 9v6" /></>,
    document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4M9 13h6M9 17h4" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    care: <><circle cx="12" cy="7" r="3" /><path d="M5 21c.8-4.3 3.1-6.5 7-6.5s6.2 2.2 7 6.5M12 14v4M10 16h4" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M13 10h5M13 14h4" /></>,
    compare: <><path d="M4 5h16M4 12h16M4 19h16" /><path d="M8 3v4M16 10v4M10 17v4" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .8-1.7 1.3-1.7 2.7M12 17h.01" /></>,
  };
  return <svg className="af-card__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function Afiliados() {
  return (
    <>
      <section className="af-hero">
        <div className="container af-hero__inner">
          <div className="af-hero__text">
            <span className="section-label" style={{color:'var(--gold-light)'}}>Para nuestros afiliados</span>
            <h1>Todo lo que necesitas<br />como <em>afiliado</em></h1>
            <p>Información, trámites y servicios diseñados para cuidar tu salud y la de tu familia.</p>
          </div>
          <div className="af-hero__img"><img src="/img/afiliados.jpg" alt="Afiliados" onError={e=>e.target.parentElement.style.display='none'} /></div>
        </div>
      </section>
      <section className="af-grid-section">
        <div className="container">
          <span className="section-label">Servicios para ti</span>
          <h2 className="section-heading">Encuentra lo que necesitas</h2>
          <p className="af-grid-intro">Consulta información, beneficios y servicios de tu afiliación en un solo lugar.</p>
          <div className="af-grid">
            {services.map((s,i) => (
              <Link key={i} to={s.to} className={`af-card ${s.size==='big'?'af-card--big':''}`}>
                <span className="af-card__icon"><ServiceIcon name={s.icon} /></span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <span className="af-card__arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
