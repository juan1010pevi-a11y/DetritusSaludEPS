import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './ConsultaIps.css';

export default function ConsultaIps() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Consulta tu IPS"
        icon="🔍"
        description="Busca tu IPS o médico especialista."
        image="/img/consulta-ips.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Consulta tu IPS' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <div className="info-card" style={{maxWidth:600,padding:'1.5rem'}}>
            <h3 style={{fontFamily:'var(--font-display)',color:'var(--navy)',marginBottom:'1.25rem'}}>Buscar IPS</h3>
            <div className="form-row">
              <div className="form-group"><label>Ciudad</label><select><option>Bogotá</option><option>Medellín</option><option>Cali</option></select></div>
              <div className="form-group"><label>Especialidad</label><select><option>Medicina general</option><option>Cardiología</option><option>Pediatría</option></select></div>
            </div>
            <div className="form-group"><label>Nombre</label><input type="text" placeholder="Ej. Clínica San Rafael" /></div>
            <button className="btn btn--primary">Buscar IPS</button>
          </div>
        </div>
      </section>
    </>
  );
}
