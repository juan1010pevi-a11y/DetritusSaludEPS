import { Link } from 'react-router-dom';
import LineIcon from '../../components/LineIcon/LineIcon';
import './Nosotros.css';

const pages = [
  { icon:'📖', title:'Historia', desc:'Cómo nació Detritus Salud. Versión oficial.', to:'/nosotros/historia', tag:'Imperdible' },
  { icon:'🎯', title:'Misión y visión', desc:'Los principios que nos guían cada día.', to:'/nosotros/mision-vision' },
  { icon:'📊', title:'Objetivos estratégicos', desc:'Las metas que nos impulsan.', to:'/nosotros/objetivos' },
  { icon:'💎', title:'Valores', desc:'Los principios éticos que nos definen.', to:'/nosotros/valores' },
  { icon:'🤝', title:'Trabaja con nosotros', desc:'Únete al equipo.', to:'/nosotros/trabaja' },
];

export default function Nosotros() {
  return (
    <>
      <section className="nos-hero">
        <div className="container nos-hero__inner">
          <div>
            <span className="section-label" style={{color:'var(--gold-light)'}}>Conócenos</span>
            <h1>Nosotros</h1>
            <p>Más que una EPS — somos un equipo comprometido con la salud de 1.2 millones de colombianos.</p>
          </div>
          <div className="nos-hero__img"><img src="/img/nosotros.jpg" alt="Nosotros" onError={e=>e.target.parentElement.style.display='none'} /></div>
        </div>
      </section>
      <section className="nos-grid-section">
        <div className="container">
          <div className="nos-grid">
            {pages.map((p, i) => (
              <Link key={i} to={p.to} className="nos-card">
                <span className="nos-card__icon"><LineIcon name={p.icon} /></span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </div>
                {p.tag && <span className="nos-card__tag">{p.tag}</span>}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
