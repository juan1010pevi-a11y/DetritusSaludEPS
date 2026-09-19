import LineIcon from '../../components/LineIcon/LineIcon';
import './Valores.css';

const valores = [
  { icon: 'heart', title: 'Humanización', text: 'Tratamos a cada afiliado como un ser humano integral, con dignidad, respeto y calidez en cada interacción.', color: '#fef2f2' },
  { icon: 'lab', title: 'Calidad', text: 'Buscamos la excelencia en cada proceso, garantizando estándares de atención de alto nivel.', color: '#eff6ff' },
  { icon: 'people', title: 'Compromiso', text: 'Cumplimos nuestras promesas con los afiliados, las familias y el sistema de salud colombiano.', color: '#f0fdf4' },
  { icon: 'search', title: 'Transparencia', text: 'Actuamos con honestidad y claridad en todos nuestros procesos, decisiones y comunicaciones.', color: '#fefce8' },
  { icon: 'lightbulb', title: 'Innovación', text: 'Adoptamos tecnología y nuevas prácticas para mejorar continuamente la experiencia del afiliado.', color: '#fdf4ff' },
  { icon: 'leaf', title: 'Responsabilidad social', text: 'Contribuimos al bienestar de las comunidades donde operamos y al desarrollo del país.', color: '#ecfdf5' },
];

export default function Valores() {
  return (
    <>
      <section className="val-hero">
        <div className="container val-hero__inner">
          <div>
            <nav className="breadcrumb"><a href="/">Inicio</a><span className="sep">›</span><a href="/nosotros">Nosotros</a><span className="sep">›</span><span>Valores</span></nav>
            <span className="section-label" style={{color:'var(--gold-light)'}}>Lo que nos define</span>
            <h1>Valores<br />institucionales</h1>
            <p>Los principios éticos que guían cada decisión y cada interacción en Detritus Salud.</p>
          </div>
          <div className="val-hero__img"><img src="/img/valores.jpg" alt="Valores" onError={e=>e.target.parentElement.style.display='none'} /></div>
        </div>
      </section>

      <section className="val-grid-section">
        <div className="container">
          <div className="val-grid">
            {valores.map((v, i) => (
              <div key={i} className="val-card" style={{'--card-bg': v.color}}>
                <div className="val-card__icon"><LineIcon name={v.icon} /></div>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
