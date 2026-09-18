import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './ActualizaDatos.css';

export default function ActualizaDatos() {
  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Actualiza tus datos"
        icon="✏️"
        description="Mantén tu información actualizada."
        image="/img/actualiza-datos.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Actualiza tus datos' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <div className="info-card" style={{maxWidth:600,padding:'1.5rem'}}>
            <h3 style={{fontFamily:'var(--font-display)',color:'var(--navy)',marginBottom:'1.25rem'}}>Actualización de datos</h3>
            <div className="form-row"><div className="form-group"><label>Nombre completo</label><input type="text" placeholder="Tu nombre" /></div><div className="form-group"><label>Documento</label><input type="text" placeholder="1020304050" /></div></div>
            <div className="form-row"><div className="form-group"><label>Teléfono</label><input type="tel" placeholder="3001234567" /></div><div className="form-group"><label>Email</label><input type="email" placeholder="correo@ejemplo.com" /></div></div>
            <div className="form-group"><label>Dirección</label><input type="text" placeholder="Calle, número, barrio" /></div>
            <button className="btn btn--primary">Guardar cambios</button>
          </div>
        </div>
      </section>
    </>
  );
}
