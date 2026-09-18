import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './PlanBeneficios.css';

export default function PlanBeneficios() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Plan de beneficios"
        icon="📋"
        description="Servicios incluidos en tu plan."
        image="/img/plan-beneficios.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Plan de beneficios' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <div className="info-grid"><InfoCard icon="🏥" title="Atención ambulatoria" text="Consultas generales, especializadas y procedimientos." /><InfoCard icon="🛏️" title="Hospitalización" text="Cirugías, cuidados intensivos y atención del parto." /><InfoCard icon="💊" title="Medicamentos" text="Todo el listado PBS del MinSalud." /><InfoCard icon="🔬" title="Diagnóstico" text="Laboratorio, imágenes y electrocardiogramas." /></div>
        </div>
      </section>
    </>
  );
}
