import { useState } from 'react';
import LineIcon from '../../components/LineIcon/LineIcon';
import './Medicamentos.css';
import Alert from '../../components/Alert/Alert';

export default function Medicamentos() {
  const [status, setStatus] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus('Datos validados. La consulta está lista para conectarse al servicio farmacéutico.');
  };

  return (
    <>
      <section className="med-hero">
        <div className="container">
          <nav className="breadcrumb"><a href="/">Inicio</a><span className="sep">›</span><a href="/afiliados">Afiliados</a><span className="sep">›</span><span>Medicamentos</span></nav>
          <span className="section-label" style={{color:'var(--gold-light)'}}>Farmacia</span>
          <h1>Medicamentos</h1>
          <p>Accede a todos los medicamentos del Plan de Beneficios en Salud sin costo con tu fórmula médica vigente.</p>
        </div>
      </section>

      <section className="med-features">
        <div className="container">
          <div className="med-split">
            <div className="med-split__img"><img src="/img/medicamentos.jpg" alt="Medicamentos" onError={e=>e.target.parentElement.style.display='none'} /></div>
            <div className="med-split__content">
              <h2 className="section-heading">¿Cómo acceder a tus medicamentos?</h2>
              <div className="med-feature">
                <div className="med-feature__num">1</div>
                <div><h4>Recibe tu fórmula médica</h4><p>Tu médico tratante emite la fórmula con los medicamentos que necesitas.</p></div>
              </div>
              <div className="med-feature">
                <div className="med-feature__num">2</div>
                <div><h4>Dirígete al punto de dispensación</h4><p>Presenta tu fórmula y cédula en cualquiera de nuestros 200+ puntos.</p></div>
              </div>
              <div className="med-feature">
                <div className="med-feature__num">3</div>
                <div><h4>Recibe tus medicamentos</h4><p>Los medicamentos PBS son entregados sin ningún costo.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="med-lookup">
        <div className="container med-lookup__layout">
          <div className="med-lookup__copy"><span className="section-label">Consulta en línea</span><h2 className="section-heading">Revisa tu fórmula y punto de entrega</h2><p>Consulta la disponibilidad de tus medicamentos con tu documento y número de fórmula.</p></div>
          <form className="med-lookup__form" onSubmit={handleSubmit}>
            <div className="form-row"><div className="form-group"><label htmlFor="medicine-document">Documento</label><input id="medicine-document" type="text" placeholder="1020304050" required /></div><div className="form-group"><label htmlFor="prescription-number">Número de fórmula</label><input id="prescription-number" type="text" placeholder="FAR-2026-1234" required /></div></div>
            <button className="btn btn--primary" type="submit">Consultar disponibilidad</button>
            {status && <p className="form-status" role="status">{status}</p>}
          </form>
        </div>
      </section>

      <section className="med-services">
        <div className="container">
          <div className="med-cards">
            <div className="med-card"><span className="med-card__icon"><LineIcon name="clipboard" /></span><h3>Medicamentos PBS</h3><p>Todos los del listado aprobado por MinSalud. Gratuitos con fórmula.</p></div>
            <div className="med-card"><span className="med-card__icon"><LineIcon name="building" /></span><h3>200+ puntos de entrega</h3><p>Disponibles en farmacias aliadas en todo el país.</p></div>
            <div className="med-card med-card--highlight"><span className="med-card__icon"><LineIcon name="home" /></span><h3>Entrega a domicilio</h3><p>Sin costo para tratamientos crónicos. Solicítalo al 018000 123 456.</p><span className="med-card__tag">Popular</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
