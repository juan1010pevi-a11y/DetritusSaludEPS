import './MisionVision.css';

export default function MisionVision() {
  return (
    <>
      <section className="mv-hero">
        <div className="container">
          <nav className="breadcrumb"><a href="/">Inicio</a><span className="sep">›</span><a href="/nosotros">Nosotros</a><span className="sep">›</span><span>Misión y visión</span></nav>
          <span className="section-label" style={{color:'var(--gold-light)'}}>Nuestro propósito</span>
          <h1>Misión y visión</h1>
        </div>
      </section>

      <section className="mv-content">
        <div className="container">
          <div className="mv-grid">
            <div className="mv-card mv-card--mision">
              <div className="mv-card__top">
                <span className="mv-card__icon">🎯</span>
                <h2>Misión</h2>
              </div>
              <img src="/img/mision-vision.jpg" alt="Misión" className="mv-card__img" onError={e=>e.target.style.display='none'} />
              <p>Garantizar el acceso a servicios de salud de alta calidad a todos nuestros afiliados, con enfoque en la <strong>humanización de la atención</strong>, la <strong>innovación tecnológica</strong> y la <strong>sostenibilidad</strong> del sistema de salud colombiano.</p>
              <div className="mv-card__pillars">
                <span>Humanización</span><span>Innovación</span><span>Sostenibilidad</span>
              </div>
            </div>
            <div className="mv-card mv-card--vision">
              <div className="mv-card__top">
                <span className="mv-card__icon">🔭</span>
                <h2>Visión 2030</h2>
              </div>
              <p className="mv-card__big-quote">"Ser la EPS más valorada de Colombia"</p>
              <p>Para 2030, ser reconocidos por la calidad de nuestra atención, la satisfacción de nuestros afiliados y nuestra contribución al mejoramiento de la salud pública nacional.</p>
              <div className="mv-card__goals">
                <div><strong>95%</strong><span>Satisfacción</span></div>
                <div><strong>1.000+</strong><span>IPS aliadas</span></div>
                <div><strong>32</strong><span>Departamentos</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
