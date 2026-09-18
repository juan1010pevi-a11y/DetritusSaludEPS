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
      <section className="content-section">
        <div className="container">
          <div className="info-grid"><InfoCard icon="👔" title="Dependiente" text="Tu empleador realiza el proceso." /><InfoCard icon="🧾" title="Independiente" text="Necesitas RUT vigente y declarar tu IBC." /></div><Alert type="gold">Cotización: 12.5% del IBC. Empleador paga 8.5%, trabajador 4%.</Alert>
        </div>
      </section>
    </>
  );
}
