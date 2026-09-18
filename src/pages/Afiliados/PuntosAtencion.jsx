import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './PuntosAtencion.css';

export default function PuntosAtencion() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Puntos de atención"
        icon="📍"
        description="Oficinas y puntos de atención."
        image="/img/puntos-atencion.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Puntos de atención' }
        ]}
      />
      <section className="affiliate-content">
        <div className="container">
          <Alert type="info">Horario general: lunes a viernes de 7:00 a. m. a 5:00 p. m. y sábados de 8:00 a. m. a 12:00 m.</Alert>
          <div className="affiliate-content__header"><div><span className="section-label">Atención presencial</span><h2 className="section-heading">Encuentra tu punto más cercano</h2><p className="affiliate-content__intro">Nuestros asesores pueden ayudarte con afiliaciones, certificados, actualización de datos y orientación sobre tus servicios.</p></div></div>
          <div className="affiliate-content__grid"><div className="affiliate-content__card"><h3>Bogotá · Sede principal</h3><p>Calle 45 No. 55-65, Piso 13</p><p>Teléfono: (601) 460-1674</p></div><div className="affiliate-content__card"><h3>Medellín</h3><p>Carrera 43A No. 1-50, El Poblado</p><p>Teléfono: (604) 350-2200</p></div><div className="affiliate-content__card"><h3>Cali</h3><p>Av. 6 Norte No. 28-10</p><p>Teléfono: (602) 880-3400</p></div></div>
        </div>
      </section>
    </>
  );
}
