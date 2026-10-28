import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './RutasAtencion.css';

export default function RutasAtencion() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Rutas integrales de atención"
        icon="🗺️"
        description="Acciones de promoción de la salud y prevención de la enfermedad."
        image="/img/rutas-atencion.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Rutas integrales de atención' }
        ]}
      />
      <section className="affiliate-content">
        <div className="container">
          <Alert type="info">Las RIAS organizan la atención por curso de vida y ayudan a prevenir enfermedades antes de que aparezcan.</Alert>
          <div className="affiliate-content__header"><div><span className="section-label">Atención integral</span><h2 className="section-heading">Elige la ruta que necesitas</h2><p className="affiliate-content__intro">Conoce los programas de promoción, prevención y atención disponibles para ti y tu familia.</p></div></div>
          <div className="affiliate-content__grid"><div className="affiliate-content__card"><h3>Salud cardiovascular</h3><p>Prevención, control de hipertensión, diabetes y riesgo cardiovascular.</p></div><div className="affiliate-content__card"><h3>Salud materna</h3><p>Control prenatal, parto seguro y atención del recién nacido.</p></div><div className="affiliate-content__card"><h3>Salud bucal</h3><p>Orientación para prevenir y tratar enfermedades de dientes y encías.</p></div><div className="affiliate-content__card"><h3>Salud mental</h3><p>Atención psicológica y acompañamiento integral para tu bienestar.</p></div></div>
        </div>
      </section>
    </>
  );
}
