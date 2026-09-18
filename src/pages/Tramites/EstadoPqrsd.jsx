import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './EstadoPqrsd.css';

export default function EstadoPqrsd() {
  const [status, setStatus] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus('Datos validados. La consulta está lista para conectarse al sistema de PQRSD.');
  };

  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Estado de tus PQRSD"
        icon="📝"
        description="Consulta peticiones, quejas, reclamos, sugerencias y denuncias."
        image="/img/estado-pqrsd.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Estado de tus PQRSD' }
        ]}
      />
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header"><span className="section-label">Seguimiento de solicitudes</span><h2 className="section-heading">Consulta el estado de tu PQRSD</h2><p className="tramite-content__intro">Ten a la mano el número de radicado y el documento con el que registraste la solicitud.</p></div>
          <form className="info-card tramite-form pqrs-form" onSubmit={handleSubmit}>
            <h2>Consultar PQRSD</h2>
            <p className="pqrs-form__intro">Ingresa los datos con los que registraste tu solicitud.</p>
            <div className="form-group"><label htmlFor="case-number">Número de radicado</label><input id="case-number" type="text" placeholder="PQRS-2026-789" required /></div>
            <div className="form-row"><div className="form-group"><label htmlFor="document-type">Tipo de documento</label><select id="document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Cédula de extranjería</option><option>Pasaporte</option><option>NIT</option></select></div><div className="form-group"><label htmlFor="document-number">Número de documento</label><input id="document-number" type="text" placeholder="1020304050" required /></div></div>
            <div className="form-group"><label htmlFor="notification-email">Correo para notificaciones <span>(opcional)</span></label><input id="notification-email" type="email" placeholder="correo@ejemplo.com" /><small>Lo usaremos únicamente para avisarte si hay novedades.</small></div>
            <button className="btn btn--primary" type="submit">Consultar estado</button>
            {status && <p className="form-status" role="status">{status}</p>}
          </form><Alert type="info">Tiempos legales orientativos: peticiones y quejas hasta 15 días hábiles; denuncias hasta 30 días hábiles.</Alert>
        </div>
      </section>
    </>
  );
}
