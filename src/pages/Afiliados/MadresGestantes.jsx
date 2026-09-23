import PageHero from '../../components/PageHero/PageHero';
import { Link } from 'react-router-dom';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './MadresGestantes.css';

export default function MadresGestantes() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Madres gestantes"
        icon="🤰"
        description="Servicios para madres en período de gestación."
        image="/img/madres-gestantes.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Madres gestantes' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <Alert type="gold">Si estás embarazada, tienes derecho a atención prioritaria sin costo adicional.</Alert>
          <div className="pregnancy-care">
            <div className="pregnancy-care__main">
              <span className="section-label">Ruta materno-perinatal</span>
              <h2 className="section-heading">Acompañamos cada etapa</h2>
              <p className="pregnancy-care__intro">Inicia tu control prenatal y recibe orientación para cuidar tu salud y la de tu bebé.</p>
              <StepList steps={[{title:"Confirma tu afiliación",text:"Verifica que estés activa con tu documento de identidad."},{title:"Solicita tu control prenatal",text:"Idealmente antes de la semana 10 de gestación en tu IPS."},{title:"Asiste a tus controles",text:"Cumple el calendario indicado por el equipo de salud."},{title:"Prepárate para el parto",text:"Accede al curso psicoprofiláctico y construye tu plan de parto."}]} />
            </div>
            <aside className="pregnancy-care__aside">
              <div className="pregnancy-care__card">
                <span className="pregnancy-care__label">Atención prioritaria</span>
                <h3>Ten presente</h3>
                <ul><li>Lleva tu documento de identidad.</li><li>Informa la fecha de tu última menstruación.</li><li>Solicita orientación ante cualquier señal de alarma.</li></ul>
                <Link to="/afiliados/puntos-atencion" className="btn btn--primary btn--sm">Encontrar una IPS</Link>
              </div>
              <p className="pregnancy-care__note">En caso de urgencia, acude al servicio de urgencias más cercano.</p>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
