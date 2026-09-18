import PageHero from '../../components/PageHero/PageHero';
import { Link } from 'react-router-dom';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './MedicinaDomiciliaria.css';

export default function MedicinaDomiciliaria() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Medicina domiciliaria"
        icon="🏠"
        description="Atención médica en tu hogar."
        image="/img/medicina-domiciliaria.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Medicina domiciliaria' }
        ]}
      />
      <section className="affiliate-content">
        <div className="container">
          <Alert type="gold">Disponible para pacientes con movilidad reducida, dependencia funcional o tratamiento crónico, según valoración médica.</Alert>
          <div className="affiliate-content__header"><div><span className="section-label">Atención en casa</span><h2 className="section-heading">Recibe cuidado donde lo necesitas</h2><p className="affiliate-content__intro">El equipo de salud evalúa tu caso y define la atención domiciliaria más adecuada para ti.</p></div></div>
          <div className="affiliate-content__stack"><div className="affiliate-content__card"><h3>1. Solicita la valoración</h3><p>Tu médico tratante debe emitir la orden de atención domiciliaria.</p></div><div className="affiliate-content__card"><h3>2. Programa la visita</h3><p>Llama a la línea nacional o solicita orientación en tu IPS.</p></div><div className="affiliate-content__card"><h3>3. Recibe la atención</h3><p>Un profesional visitará tu domicilio en el horario acordado.</p></div></div>
          <div className="affiliate-content__footer"><Link to="/atencion" className="btn btn--primary">Hablar con atención al usuario</Link><span className="affiliate-content__note">Para urgencias, acude al servicio de urgencias más cercano.</span></div>
        </div>
      </section>
    </>
  );
}
