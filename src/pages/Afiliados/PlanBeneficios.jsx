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
      <section className="affiliate-content">
        <div className="container">
          <div className="affiliate-content__header"><div><span className="section-label">Cobertura en salud</span><h2 className="section-heading">Servicios incluidos en tu plan</h2><p className="affiliate-content__intro">Consulta las principales atenciones cubiertas por el Plan de Beneficios en Salud y conoce cómo acceder a ellas.</p></div></div>
          <div className="affiliate-content__grid"><div className="affiliate-content__card"><h3>Atención ambulatoria</h3><p>Consultas generales, especializadas y procedimientos de atención.</p></div><div className="affiliate-content__card"><h3>Hospitalización</h3><p>Cirugías, cuidados intensivos y atención del parto cuando se requiera.</p></div><div className="affiliate-content__card"><h3>Medicamentos</h3><p>Medicamentos incluidos en el PBS con fórmula médica vigente.</p></div><div className="affiliate-content__card"><h3>Diagnóstico</h3><p>Laboratorio clínico, imágenes diagnósticas y electrocardiogramas.</p></div></div>
        </div>
      </section>
    </>
  );
}
