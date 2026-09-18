import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './PuntosAtencion.css';

export default function PuntosAtencion() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Puntos de atención"
        icon="📍"
        description="Oficinas y puntos de atención."
        image="/img/puntos-atencion.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Puntos de atención' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <Alert type="info">Lunes a viernes 7am–5pm · Sábados 8am–12pm</Alert><div className="info-grid"><InfoCard icon="🏙️" title="Bogotá — Sede principal" text="Calle 45 No. 55-65, Piso 13 · ☎ (601) 460-1674" /><InfoCard icon="🏙️" title="Medellín" text="Carrera 43A No. 1-50, El Poblado · ☎ (604) 350-2200" /><InfoCard icon="🏙️" title="Cali" text="Av. 6 Norte No. 28-10 · ☎ (602) 880-3400" /></div>
        </div>
      </section>
    </>
  );
}
