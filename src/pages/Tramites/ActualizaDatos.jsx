import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './ActualizaDatos.css';

export default function ActualizaDatos() {
  const [status, setStatus] = useState('');
  const handleSubmit = (event) => { event.preventDefault(); setStatus('Información validada. La actualización está lista para conectarse al sistema de afiliados.'); };
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
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header"><span className="section-label">Información del afiliado</span><h2 className="section-heading">Mantén tus datos al día</h2><p className="tramite-content__intro">Actualiza tus datos de contacto para recibir notificaciones, certificados y confirmaciones sin inconvenientes.</p></div>
          <form className="info-card tramite-form" onSubmit={handleSubmit}><h2>Actualización de datos</h2><p className="tramite-form__intro">Completa únicamente la información que deseas actualizar.</p><div className="form-row"><div className="form-group"><label htmlFor="update-name">Nombre completo</label><input id="update-name" type="text" placeholder="Tu nombre" required /></div><div className="form-group"><label htmlFor="update-document">Documento</label><input id="update-document" type="text" placeholder="1020304050" required /></div></div><div className="form-row"><div className="form-group"><label htmlFor="update-phone">Teléfono</label><input id="update-phone" type="tel" placeholder="3001234567" required /></div><div className="form-group"><label htmlFor="update-email">Correo electrónico</label><input id="update-email" type="email" placeholder="correo@ejemplo.com" required /></div></div><div className="form-group"><label htmlFor="update-address">Dirección</label><input id="update-address" type="text" placeholder="Calle, número, barrio" required /></div><button className="btn btn--primary" type="submit">Guardar cambios</button>{status && <p className="form-status" role="status">{status}</p>}</form>
        </div>
      </section>
    </>
  );
}
