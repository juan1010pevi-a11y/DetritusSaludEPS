import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './Certificado.css';

export default function Certificado() {
  const [status, setStatus] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus('Datos validados. El certificado está listo para conectarse al servicio de descarga segura.');
  };

  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Certificado de afiliación"
        icon="📜"
        description="Descarga tu certificado vigente."
        image="/img/certificado.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Certificado de afiliación' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <div className="certificate-layout">
            <form className="info-card certificate-form" onSubmit={handleSubmit}>
              <h2>Descarga tu certificado</h2>
              <p className="certificate-form__intro">Verifica tu identidad para generar un certificado vigente con código QR.</p>
              <div className="form-row"><div className="form-group"><label htmlFor="certificate-document-type">Tipo de documento</label><select id="certificate-document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option><option>Pasaporte</option></select></div><div className="form-group"><label htmlFor="certificate-document">Número de documento</label><input id="certificate-document" type="text" placeholder="1020304050" required /></div></div>
              <div className="form-group"><label htmlFor="certificate-email">Correo electrónico</label><input id="certificate-email" type="email" placeholder="correo@ejemplo.com" required /></div>
              <button className="btn btn--primary" type="submit">Generar certificado</button>
              {status && <p className="form-status" role="status">{status}</p>}
            </form>
            <div className="certificate-steps"><span className="section-label">Proceso digital</span><h2 className="section-heading">Obtén tu certificado en tres pasos</h2><StepList steps={[{title:"Ingresa tus datos",text:"Usa el documento registrado en tu afiliación."},{title:"Verifica tu correo",text:"Te enviaremos la confirmación de la solicitud."},{title:"Descarga el PDF",text:"Recibirás un certificado vigente con código QR."}]} /></div>
          </div>
          <Alert type="gold">También puedes solicitarlo gratis en cualquier punto de atención.</Alert>
        </div>
      </section>
    </>
  );
}
