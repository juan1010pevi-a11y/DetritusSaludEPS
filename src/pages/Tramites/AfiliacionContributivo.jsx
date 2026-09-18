import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './AfiliacionContributivo.css';

export default function AfiliacionContributivo() {
  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Afiliación régimen contributivo"
        icon="💼"
        description="Para trabajadores dependientes e independientes."
        image="/img/afiliacion-contributivo.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Afiliación régimen contributivo' }
        ]}
      />
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header"><span className="section-label">Afiliación contributiva</span><h2 className="section-heading">Elige la ruta que corresponde a tu trabajo</h2><p className="tramite-content__intro">Conoce los documentos y responsabilidades según seas trabajador dependiente o independiente.</p></div>
          <div className="tramite-grid"><div className="tramite-card"><h3>Trabajador dependiente</h3><p>Tu empleador gestiona la afiliación y realiza los aportes correspondientes.</p><ul><li>Documento de identidad</li><li>Contrato o certificación laboral</li><li>Formulario de afiliación</li></ul></div><div className="tramite-card"><h3>Trabajador independiente</h3><p>Realizas tus aportes directamente sobre tu ingreso base de cotización.</p><ul><li>Documento de identidad</li><li>RUT vigente</li><li>Declaración del IBC</li></ul></div></div><Alert type="gold">La cotización corresponde al 12,5% del IBC. Verifica los valores vigentes antes de realizar el trámite.</Alert>
        </div>
      </section>
    </>
  );
}
