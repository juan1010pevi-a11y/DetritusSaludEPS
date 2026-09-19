import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './ConsultaIps.css';

export default function ConsultaIps() {
  const [status, setStatus] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus('Búsqueda lista para conectarse al directorio actualizado de IPS.');
  };

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
      <section className="affiliate-content">
        <div className="container">
          <div className="affiliate-content__header"><div><span className="section-label">Red de prestadores</span><h2 className="section-heading">Encuentra tu IPS</h2><p className="affiliate-content__intro">Busca una institución o especialista de nuestra red según tu ciudad y necesidad de atención.</p></div></div>
          <form className="info-card ips-search-form" onSubmit={handleSubmit}>
            <h3>Buscar en el directorio</h3>
            <div className="form-row">
              <div className="form-group"><label htmlFor="ips-city">Ciudad</label><select id="ips-city" required><option>Bogotá</option><option>Medellín</option><option>Cali</option></select></div>
              <div className="form-group"><label htmlFor="ips-specialty">Especialidad</label><select id="ips-specialty" required><option>Medicina general</option><option>Cardiología</option><option>Pediatría</option></select></div>
            </div>
            <div className="form-group"><label htmlFor="ips-name">Nombre de IPS o especialista <span>(opcional)</span></label><input id="ips-name" type="text" placeholder="Ej. Clínica San Rafael" /></div>
            <button className="btn btn--primary" type="submit">Buscar IPS</button>{status && <p className="form-status" role="status">{status}</p>}
          </form>
        </div>
      </section>
    </>
  );
}
