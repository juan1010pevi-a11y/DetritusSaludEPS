import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './PreguntasFrecuentes.css';

export default function PreguntasFrecuentes() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Preguntas frecuentes"
        icon="❓"
        description="Resolvemos las dudas más comunes."
        image="/img/preguntas-frecuentes.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Preguntas frecuentes' }
        ]}
      />
      <section className="affiliate-content">
        <div className="container">
          <div className="affiliate-content__header"><div><span className="section-label">Centro de ayuda</span><h2 className="section-heading">Respuestas rápidas para ti</h2><p className="affiliate-content__intro">Encuentra orientación sobre los trámites y servicios más consultados por nuestros afiliados.</p></div></div>
          <div className="affiliate-content__stack"><div className="affiliate-content__card"><h3>¿Cómo solicito una autorización?</h3><p>Ingresa al portal, selecciona la opción de autorizaciones y sigue los pasos indicados.</p></div><div className="affiliate-content__card"><h3>¿Cuánto tarda una autorización?</h3><p>Las urgencias se gestionan con prioridad. Las solicitudes electivas pueden tardar hasta 5 días hábiles.</p></div><div className="affiliate-content__card"><h3>¿Puedo cambiar de IPS?</h3><p>Sí. Solicítalo una vez al año por el portal o en un punto de atención.</p></div><div className="affiliate-content__card"><h3>¿Cómo agrego un beneficiario?</h3><p>Presenta la cédula del titular y el registro civil del beneficiario en un punto de atención.</p></div></div>
        </div>
      </section>
    </>
  );
}
