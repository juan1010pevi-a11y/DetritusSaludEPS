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
      <section className="tramite-content">
        <div className="container">
          <Alert type="info">La consulta oficial se realiza directamente en ADRES. Te recomendamos verificar que estés en el dominio oficial antes de ingresar tus datos.</Alert>
          <div className="tramite-content__header"><span className="section-label">Consulta oficial</span><h2 className="section-heading">Verifica tu EPS en ADRES</h2><p className="tramite-content__intro">ADRES te permite consultar la entidad, régimen y estado de afiliación registrados en el sistema de salud.</p></div>
          <div className="tramite-steps"><div className="tramite-step"><span className="tramite-step__num">1</span><div><h3>Ingresa al portal oficial</h3><p>Abre el sitio web de ADRES desde el botón inferior.</p></div></div><div className="tramite-step"><span className="tramite-step__num">2</span><div><h3>Digita tu documento</h3><p>Selecciona el tipo de documento e ingresa el número solicitado.</p></div></div><div className="tramite-step"><span className="tramite-step__num">3</span><div><h3>Revisa el resultado</h3><p>Consulta tu EPS activa, régimen y estado de afiliación.</p></div></div></div><div className="tramite-form__footer"><a href="https://www.adres.gov.co" target="_blank" rel="noopener noreferrer" className="btn btn--primary">Ir al portal ADRES</a><span className="tramite-note">Se abrirá el sitio oficial en una nueva pestaña.</span></div>
        </div>
      </section>
    </>
  );
}
