import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import Alert from '../../components/Alert/Alert';
import './AgendarCita.css';

export default function AgendarCita() {
  const [status, setStatus] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus('Solicitud registrada. Un asesor confirmará la disponibilidad por tus canales de contacto.');
  };

  return (
    <>
      <PageHero
        label="Servicios digitales"
        title="Agendar cita médica"
        description="Solicita una cita con tu IPS y especialidad preferida."
        image="/img/atencion-usuario.jpg"
        breadcrumb={[{ label: 'Trámites', path: '/tramites' }, { label: 'Agendar cita' }]}
      />
      <section className="content-section">
        <div className="container appointment-layout">
          <form className="info-card appointment-form" onSubmit={handleSubmit}>
            <h2>Solicita tu cita</h2>
            <p className="appointment-form__intro">Completa los datos del paciente para revisar las opciones disponibles.</p>
            <div className="form-row">
              <div className="form-group"><label htmlFor="appointment-document-type">Tipo de documento</label><select id="appointment-document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option><option>Pasaporte</option></select></div>
              <div className="form-group"><label htmlFor="appointment-document">Número de documento</label><input id="appointment-document" type="text" placeholder="1020304050" required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label htmlFor="appointment-specialty">Especialidad</label><select id="appointment-specialty" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Medicina general</option><option>Medicina interna</option><option>Pediatría</option><option>Odontología</option><option>Psicología</option></select></div>
              <div className="form-group"><label htmlFor="appointment-city">Ciudad</label><select id="appointment-city" defaultValue="" required><option value="" disabled>Selecciona una ciudad</option><option>Bogotá</option><option>Medellín</option><option>Cali</option><option>Otra ciudad</option></select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label htmlFor="appointment-modality">Modalidad</label><select id="appointment-modality" defaultValue="" required><option value="" disabled>Selecciona una modalidad</option><option>Presencial</option><option>Teleconsulta</option></select></div>
              <div className="form-group"><label htmlFor="appointment-date">Fecha preferida</label><input id="appointment-date" type="date" required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label htmlFor="appointment-phone">Teléfono</label><input id="appointment-phone" type="tel" placeholder="3001234567" required /></div>
              <div className="form-group"><label htmlFor="appointment-email">Correo electrónico</label><input id="appointment-email" type="email" placeholder="correo@ejemplo.com" required /></div>
            </div>
            <button className="btn btn--primary" type="submit">Buscar disponibilidad</button>
            {status && <p className="form-status" role="status">{status}</p>}
          </form>
          <aside className="appointment-aside">
            <div className="appointment-note"><span className="appointment-note__label">Antes de agendar</span><h3>Ten presente</h3><ul><li>Ten tu documento a la mano.</li><li>La fecha solicitada está sujeta a disponibilidad.</li><li>Para una urgencia, acude al servicio de urgencias más cercano.</li></ul></div>
            <Alert type="info">Las citas de medicina general pueden solicitarse también por nuestra línea nacional.</Alert>
          </aside>
        </div>
      </section>
    </>
  );
}
