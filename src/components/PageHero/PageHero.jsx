import { Link } from 'react-router-dom';
import './PageHero.css';

export default function PageHero({ label, title, description, image, breadcrumb }) {
  return (
    <section className="page-hero">
      <div className="container">
        {breadcrumb && (
          <nav className="breadcrumb" aria-label="Ruta">
            <Link to="/">Inicio</Link>
            {breadcrumb.map((b, i) => (
              <span key={i}><span className="sep">›</span>{b.path ? <Link to={b.path}>{b.label}</Link> : <span>{b.label}</span>}</span>
            ))}
          </nav>
        )}
        {label && <span className="section-label">{label}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {image && (
          <div className="page-hero__banner">
            <img src={image} alt={title} className="page-hero__img" onError={e=>e.target.parentElement.style.display='none'} />
          </div>
        )}
      </div>
    </section>
  );
}
