import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './Regimen.css';

export default function Regimen() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Régimen subsidiado y contributivo"
        icon="📑"
        description="Diferencias entre los dos regímenes."
        image="/img/regimen.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Régimen subsidiado y contributivo' }
        ]}
      />
      <section className="affiliate-content">
        <div className="container">
          <div className="affiliate-content__header"><div><span className="section-label">Conoce tu afiliación</span><h2 className="section-heading">¿Qué régimen te corresponde?</h2><p className="affiliate-content__intro">La diferencia depende de tu situación laboral y capacidad de pago. Revisa esta guía antes de iniciar un trámite.</p></div></div>
          <div className="affiliate-content__grid"><div className="affiliate-content__card"><h3>Régimen contributivo</h3><p>Para trabajadores dependientes, independientes y pensionados que realizan aportes al sistema.</p><ul><li>Cotización sobre el ingreso base</li><li>Incluye beneficiarios del grupo familiar</li><li>Acceso a servicios del PBS</li></ul></div><div className="affiliate-content__card"><h3>Régimen subsidiado</h3><p>Para personas sin capacidad de pago clasificadas por el SISBEN según la normativa vigente.</p><ul><li>Afiliación sin costo</li><li>Servicios del PBS</li><li>Orientación en puntos de atención</li></ul></div></div><Alert type="info">Consulta tu clasificación SISBEN o habla con un asesor en cualquier punto de atención.</Alert>
        </div>
      </section>
    </>
  );
}
