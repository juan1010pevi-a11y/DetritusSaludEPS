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
      <section className="tramite-content">
        <div className="container">
          <Alert type="info">Recibe atención en otra ciudad sin perder tu afiliación ni trasladarte a tu lugar de origen.</Alert>
          <div className="tramite-content__header"><span className="section-label">Atención en otra ciudad</span><h2 className="section-heading">Solicita tu portabilidad</h2><p className="tramite-content__intro">La portabilidad te permite recibir atención temporal en una ciudad diferente a la de tu afiliación.</p></div>
          <div className="tramite-steps"><div className="tramite-step"><span className="tramite-step__num">1</span><div><h3>Solicita la portabilidad</h3><p>Haz la solicitud por el portal o a través de la línea nacional.</p></div></div><div className="tramite-step"><span className="tramite-step__num">2</span><div><h3>Recibe tu código</h3><p>La respuesta puede llegar en 24 horas y tendrá una vigencia determinada.</p></div></div><div className="tramite-step"><span className="tramite-step__num">3</span><div><h3>Preséntalo en la IPS</h3><p>Lleva el código y tu documento de identidad al punto de atención de la ciudad destino.</p></div></div></div>
          <div className="tramite-form__footer"><a href="tel:018000123456" className="btn btn--primary">Solicitar orientación</a><span className="tramite-note">Ten a la mano tu ciudad de destino y las fechas de permanencia.</span></div>
        </div>
      </section>
    </>
  );
}
