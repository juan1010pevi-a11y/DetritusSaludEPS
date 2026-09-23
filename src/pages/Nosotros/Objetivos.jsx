import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './Objetivos.css';

export default function Objetivos() {
  return (
    <>
      <PageHero
        label="Nosotros"
        title="Objetivos estratégicos"
        icon="📊"
        description="Metas de Detritus Salud E.P.S."
        image="/img/objetivos.jpg"
        breadcrumb={[
          { label: 'Nosotros', path: '/nosotros' },
          { label: 'Objetivos estratégicos' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <div className="info-grid"><InfoCard icon="⭐" title="Calidad" text="95% de satisfacción en todos los servicios." /><InfoCard icon="🚀" title="Innovación digital" text="Digitalizar 80% de trámites frecuentes." /><InfoCard icon="🌿" title="Sostenibilidad" text="Sostenibilidad financiera con cobertura universal." /><InfoCard icon="🤝" title="Red de prestadores" text="1.000 IPS en 32 departamentos antes de 2027." /></div>
        </div>
      </section>
    </>
  );
}
