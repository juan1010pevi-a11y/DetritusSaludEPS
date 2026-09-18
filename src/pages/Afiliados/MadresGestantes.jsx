import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
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
          <Alert type="gold">Si estás embarazada, tienes derecho a atención prioritaria sin costo adicional.</Alert><StepList steps={[{title:"Confirma tu afiliación",text:"Verifica que estás activa con tu documento de identidad."},{title:"Solicita control prenatal",text:"Antes de la semana 10 de gestación en tu IPS."},{title:"Controles periódicos",text:"Mínimo 4 controles prenatales garantizados."},{title:"Prepárate para el parto",text:"Curso psicoprofiláctico gratuito y plan de parto."}]} />
        </div>
      </section>
    </>
  );
}
