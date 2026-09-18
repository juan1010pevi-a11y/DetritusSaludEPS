import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './Portabilidad.css';

export default function Portabilidad() {
  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Solicitud de portabilidad"
        icon="🔄"
        description="Atención fuera de tu ciudad de afiliación."
        image="/img/portabilidad.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Solicitud de portabilidad' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <Alert type="info">Recibe atención en cualquier ciudad sin trasladarte a tu ciudad de origen.</Alert><StepList steps={[{title:"Solicita la portabilidad",text:"Por el portal o al 018000 123 456."},{title:"Recibe tu código",text:"En 24 horas, válido hasta 1 año."},{title:"Presenta el código",text:"En la IPS de la ciudad destino con tu cédula."}]} />
        </div>
      </section>
    </>
  );
}
