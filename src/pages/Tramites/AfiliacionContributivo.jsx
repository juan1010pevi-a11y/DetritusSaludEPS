import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './AfiliacionContributivo.css';
import { register } from '../../services/api';

export default function AfiliacionContributivo() {
  const [status, setStatus] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Registrando afiliado...');
    try {
      const affiliate = await register({
        name: form.get('name'),
        document: form.get('document'),
        password: form.get('password'),
        plan: 'contributivo',
      });
      event.currentTarget.reset();
      setStatus(`Registro exitoso. Ya puedes ingresar con el documento ${affiliate.document}.`);
    } catch (error) {
      setStatus(error.message.includes('409') ? 'Ese documento ya está registrado.' : 'No fue posible completar el registro.');
    }
  };

  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Afiliación régimen contributivo"
        icon="💼"
        description="Para trabajadores dependientes e independientes."
        image="/img/afiliacion-contributivo.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Afiliación régimen contributivo' }
        ]}
      />
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header"><span className="section-label">Afiliación contributiva</span><h2 className="section-heading">Elige la ruta que corresponde a tu trabajo</h2><p className="tramite-content__intro">Conoce los documentos y responsabilidades según seas trabajador dependiente o independiente.</p></div>
          <div className="tramite-grid"><Link to="/afiliados/requisitos" className="tramite-card"><h3>Trabajador dependiente</h3><p>Tu empleador gestiona la afiliación y realiza los aportes correspondientes.</p><ul><li>Documento de identidad</li><li>Contrato o certificación laboral</li><li>Formulario de afiliación</li></ul><span className="tramite-card__action">Ver requisitos →</span></Link><Link to="/afiliados/puntos-atencion" className="tramite-card"><h3>Trabajador independiente</h3><p>Realizas tus aportes directamente sobre tu ingreso base de cotización.</p><ul><li>Documento de identidad</li><li>RUT vigente</li><li>Declaración del IBC</li></ul><span className="tramite-card__action">Ver puntos de atención →</span></Link></div><Alert type="gold">La cotización corresponde al 12,5% del IBC. Verifica los valores vigentes antes de realizar el trámite.</Alert>
          <form className="info-card registration-form" onSubmit={handleSubmit}>
            <h2>Regístrate en línea</h2>
            <p>Crearás una cuenta de prueba persistida en el sistema de afiliados.</p>
            <div className="form-row">
              <div className="form-group"><label htmlFor="register-name">Nombre completo</label><input id="register-name" name="name" required /></div>
              <div className="form-group"><label htmlFor="register-document">Número de documento</label><input id="register-document" name="document" required /></div>
            </div>
            <div className="form-group"><label htmlFor="register-password">Contraseña</label><input id="register-password" name="password" type="password" minLength="6" required /></div>
            <button className="btn btn--primary" type="submit">Crear cuenta</button>
            {status && <p className="form-status" role="status">{status}</p>}
          </form>
        </div>
      </section>
    </>
  );
}
