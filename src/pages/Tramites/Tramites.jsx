import { Link } from 'react-router-dom';
import './Tramites.css';

const tramites = [
  { num:'01', icon:'people', title:'Afiliación subsidiado', desc:'Proceso gratuito para SISBEN.', to:'/tramites/afiliacion-subsidiado' },
  { num:'02', icon:'briefcase', title:'Afiliación contributivo', desc:'Para trabajadores.', to:'/tramites/afiliacion-contributivo' },
  { num:'03', icon:'search', title:'Consulta de afiliados', desc:'Verifica tu estado.', to:'/tramites/consulta-afiliados' },
  { num:'04', icon:'certificate', title:'Certificado', desc:'Descarga con código QR.', to:'/tramites/certificado' },
  { num:'05', icon:'refresh', title:'Portabilidad', desc:'Atención en otra ciudad.', to:'/tramites/portabilidad' },
  { num:'06', icon:'edit', title:'Actualiza datos', desc:'Mantén tu info al día.', to:'/tramites/actualiza-datos' },
  { num:'07', icon:'lock', title:'Autorizaciones', desc:'Consulta el estado.', to:'/tramites/autorizaciones' },
  { num:'08', icon:'building', title:'Asignación EPS', desc:'Portal ADRES MinSalud.', to:'/tramites/asignacion-eps' },
  { num:'09', icon:'document', title:'Estado PQRSD', desc:'Tus peticiones y quejas.', to:'/tramites/estado-pqrsd' },
];

function TramiteIcon({ name }) {
  const paths = {
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 19c.6-3 2.5-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 15c2.8-.6 5.1.9 6 4" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    certificate: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v5h4M8 12h8M8 16h5" /><path d="m15 18 2 3 2-3" /></>,
    refresh: <><path d="M4 12a8 8 0 0 1 13.5-5.8L20 9" /><path d="M20 4v5h-5M20 12a8 8 0 0 1-13.5 5.8L4 15" /><path d="M4 20v-5h5" /></>,
    edit: <><path d="m4 16-.8 4.8L8 20l11-11a2.8 2.8 0 0 0-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    building: <><path d="M4 21V5l8-3 8 3v16M2 21h20M8 8h1M15 8h1M8 12h1M15 12h1M8 16h1M15 16h1" /></>,
    document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4M9 13h6M9 17h4" /></>,
  };
  return <svg className="tr-card__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function Tramites() {
  return (
    <>
      <section className="tr-hero">
        <div className="container tr-hero__inner">
          <div>
            <span className="section-label" style={{color:'var(--gold-light)'}}>Servicios digitales</span>
            <h1>Trámites<br />en <em>línea</em></h1>
            <p>Realiza tus trámites de salud de forma rápida, segura y sin salir de casa.</p>
          </div>
          <div className="tr-hero__img"><img src="/img/consulta-afiliados.jpg" alt="Servicios digitales para afiliados" onError={e=>e.target.parentElement.style.display='none'} /></div>
        </div>
      </section>
      <section className="tr-grid-section">
        <div className="container">
          <div className="tr-grid">
            {tramites.map(t => (
              <Link key={t.num} to={t.to} className="tr-card">
                <span className="tr-card__num">{t.num}</span>
                <span className="tr-card__icon"><TramiteIcon name={t.icon} /></span>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
