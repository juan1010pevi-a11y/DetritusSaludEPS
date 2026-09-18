import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './RutasAtencion.css';

export default function RutasAtencion() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Rutas integrales de atención"
        icon="🗺️"
        description="Acciones de promoción de la salud y prevención de la enfermedad."
        image="/img/rutas-atencion.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Rutas integrales de atención' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <Alert type="info">Las RIAS definen los procesos que garantizan tu atención oportuna y de calidad.</Alert><div className="info-grid"><InfoCard icon="❤️" title="Salud cardiovascular" text="Detección de hipertensión, diabetes y riesgo cardiovascular." /><InfoCard icon="🤰" title="Maternidad" text="Control prenatal, parto y atención del recién nacido." /><InfoCard icon="🦷" title="Salud bucal" text="Prevención y tratamiento de enfermedades bucales." /><InfoCard icon="🧠" title="Salud mental" text="Atención integral en salud mental." /></div>
        </div>
      </section>
    </>
  );
}
