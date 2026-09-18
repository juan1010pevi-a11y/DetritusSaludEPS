import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import Alert from '../../components/Alert/Alert';
import './RadicarPqrsd.css';

export default function RadicarPqrsd() {
  const [status, setStatus] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus('Solicitud validada. Al conectarse con el sistema se generará tu número de radicado.');
  };

  return (
    <>
      <PageHero label="Trámites en línea" title="Radicar una PQRSD" description="Presenta una petición, queja, reclamo, sugerencia o denuncia." image="/img/estado-pqrsd.jpg" breadcrumb={[{ label: 'Trámites', path: '/tramites' }, { label: 'Radicar PQRSD' }]} />
      <section className="content-section">
        <div className="container pqrs-submit-layout">
          <form className="info-card pqrs-submit-form" onSubmit={handleSubmit}>
            <h2>Cuéntanos tu solicitud</h2>
            <p className="pqrs-submit-form__intro">Diligencia la información para que podamos revisar y responder tu caso.</p>
            <div className="form-row"><div className="form-group"><label htmlFor="pqrs-type">Tipo de solicitud</label><select id="pqrs-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Petición</option><option>Queja</option><option>Reclamo</option><option>Sugerencia</option><option>Denuncia</option></select></div><div className="form-group"><label htmlFor="pqrs-subject">Asunto</label><input id="pqrs-subject" type="text" placeholder="Motivo de tu solicitud" required /></div></div>
            <div className="form-row"><div className="form-group"><label htmlFor="pqrs-name">Nombre completo</label><input id="pqrs-name" type="text" placeholder="Tu nombre" required /></div><div className="form-group"><label htmlFor="pqrs-document">Documento</label><input id="pqrs-document" type="text" placeholder="1020304050" required /></div></div>
            <div className="form-row"><div className="form-group"><label htmlFor="pqrs-email">Correo electrónico</label><input id="pqrs-email" type="email" placeholder="correo@ejemplo.com" required /></div><div className="form-group"><label htmlFor="pqrs-phone">Teléfono</label><input id="pqrs-phone" type="tel" placeholder="3001234567" required /></div></div>
            <div className="form-group"><label htmlFor="pqrs-description">Describe tu solicitud</label><textarea id="pqrs-description" placeholder="Escribe los detalles de tu caso..." required /></div>
            <label className="pqrs-consent"><input type="checkbox" required /><span>Autorizo el tratamiento de mis datos para gestionar esta solicitud.</span></label>
            <button className="btn btn--primary" type="submit">Enviar PQRSD</button>
            {status && <p className="form-status" role="status">{status}</p>}
          </form>
          <aside className="pqrs-submit-aside"><div className="pqrs-submit-note"><span className="pqrs-submit-note__label">Después de enviar</span><h3>Recibirás un radicado</h3><p>Con tu número de radicado podrás consultar el avance de la solicitud en cualquier momento.</p><ul><li>Conserva el número de radicado.</li><li>Revisa tu correo para novedades.</li><li>Consulta los tiempos legales de respuesta.</li></ul></div><Alert type="info">Para consultar una solicitud existente, usa la opción “Consultar estado de PQRSD”.</Alert></aside>
        </div>
      </section>
    </>
  );
}
