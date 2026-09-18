import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './ConsultaAfiliados.css';

export default function ConsultaAfiliados() {
  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Consulta de afiliados"
        icon="🔍"
        description="Verifica el estado de afiliación."
        image="/img/consulta-afiliados.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Consulta de afiliados' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <div className="info-card" style={{maxWidth:540,padding:'1.5rem'}}>
            <h3 style={{fontFamily:'var(--font-display)',color:'var(--navy)',marginBottom:'1.25rem'}}>Consultar afiliación</h3>
            <div className="form-group"><label>Tipo de documento</label><select><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option></select></div>
            <div className="form-group"><label>Número</label><input type="text" placeholder="Ej. 1020304050" /></div>
            <button className="btn btn--primary">Consultar</button>
          </div>
        </div>
      </section>
    </>
  );
}
