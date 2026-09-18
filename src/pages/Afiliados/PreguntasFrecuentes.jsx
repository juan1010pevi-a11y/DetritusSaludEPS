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
      <section className="content-section">
        <div className="container">
          <StepList steps={[{num:"?",title:"¿Cómo solicito una autorización?",text:"Ingresa al portal, selecciona Solicitar autorización y sigue el proceso."},{num:"?",title:"¿Cuánto tarda una autorización?",text:"Urgencias: 30 min. Electivas: 5 días hábiles."},{num:"?",title:"¿Puedo cambiar de IPS?",text:"Sí, una vez al año por el portal o puntos de atención."},{num:"?",title:"¿Cómo agrego un beneficiario?",text:"Cédula del titular + registro civil del beneficiario en punto de atención."}]} />
        </div>
      </section>
    </>
  );
}
