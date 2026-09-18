import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './ConsultaAfiliados.css';

export default function ConsultaAfiliados() {
  const [status, setStatus] = useState('');
  const handleSubmit = (event) => { event.preventDefault(); setStatus('Datos validados. La consulta está lista para conectarse al sistema de afiliaciones.'); };
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
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header"><span className="section-label">Consulta en línea</span><h2 className="section-heading">Verifica tu afiliación</h2><p className="tramite-content__intro">Confirma si tu afiliación está activa, el régimen al que perteneces y la información básica registrada.</p></div>
          <form className="info-card tramite-form" onSubmit={handleSubmit}><h2>Consultar afiliación</h2><p className="tramite-form__intro">Ingresa los datos del afiliado.</p><div className="form-group"><label htmlFor="affiliate-document-type">Tipo de documento</label><select id="affiliate-document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option></select></div><div className="form-group"><label htmlFor="affiliate-document">Número de documento</label><input id="affiliate-document" type="text" placeholder="Ej. 1020304050" required /></div><button className="btn btn--primary" type="submit">Consultar estado</button>{status && <p className="form-status" role="status">{status}</p>}</form>
        </div>
      </section>
    </>
  );
}
