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
      <section className="content-section">
        <div className="container">
          <div className="info-grid"><InfoCard icon="💼" title="Régimen contributivo" text="Para trabajadores. Cotización del 12.5% del salario base." /><InfoCard icon="🤝" title="Régimen subsidiado" text="Para población sin capacidad de pago, clasificada por SISBEN. Sin costo." /></div><Alert type="info">Consulta tu clasificación SISBEN o habla con un asesor en cualquier punto de atención.</Alert>
        </div>
      </section>
    </>
  );
}
