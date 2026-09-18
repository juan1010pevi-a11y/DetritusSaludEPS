import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './AsignacionEps.css';

export default function AsignacionEps() {
  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Asignación de EPS — MinSalud"
        icon="🏛️"
        description="Consulta tu asignación en la plataforma ADRES."
        image="/img/asignacion-eps.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Asignación de EPS — MinSalud' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <Alert type="info">Esta consulta se realiza directamente en el portal ADRES.</Alert><StepList steps={[{title:"Ingresa al portal ADRES",text:"Visita www.adres.gov.co → Consulta de afiliados."},{title:"Ingresa tu documento",text:"Digita tu cédula o tarjeta de identidad."},{title:"Verifica tu EPS",text:"Verás tu EPS activa, régimen y estado."}]} /><a href="https://www.adres.gov.co" target="_blank" rel="noopener noreferrer" className="btn btn--primary">Ir al portal ADRES ↗</a>
        </div>
      </section>
    </>
  );
}
