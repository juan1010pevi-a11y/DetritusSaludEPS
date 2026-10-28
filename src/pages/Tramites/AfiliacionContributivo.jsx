import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './AfiliacionContributivo.css';
import { register } from '../../services/api';
import { DocumentInput, PasswordHints, PasswordInput, PhoneInput } from '../../components/FormFields/FormFields';
import { documentError, emailError, nameError, passwordError, phoneError } from '../../lib/validators';

export default function AfiliacionContributivo() {
  const [status, setStatus] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      name: String(form.get('name') || '').trim(),
      document: String(form.get('document') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      password: form.get('password'),
      whatsappOptIn: form.get('whatsapp') === 'on',
      plan: 'contributivo',
    };
    const problem = nameError(payload.name) || documentError(payload.document) || emailError(payload.email) || phoneError(payload.phone) || passwordError(payload.password);
    if (problem) { setStatus(problem); return; }
    setStatus('Registrando afiliado...');
    try {
      const affiliate = await register(payload);
      formElement.reset();
      setPassword('');
      setStatus(affiliate.linked
        ? `Listo, ${affiliate.name}: vinculamos tu afiliación a tu cuenta de médico. Ingresa con tu mismo documento y cambia entre perfiles desde el menú.`
        : `Registro exitoso. Ya puedes ingresar con el documento ${affiliate.document}.`);
    } catch (error) {
      setStatus(error.message || 'No fue posible completar el registro.');
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
              <div className="form-group"><label htmlFor="register-name">Nombre completo</label><input id="register-name" name="name" maxLength={120} required /></div>
              <div className="form-group"><label htmlFor="register-document">Número de documento</label><DocumentInput id="register-document" name="document" required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label htmlFor="register-email">Correo electrónico</label><input id="register-email" name="email" type="email" placeholder="correo@ejemplo.com" maxLength={120} required /></div>
              <div className="form-group"><label htmlFor="register-phone">Celular</label><PhoneInput id="register-phone" name="phone" required /></div>
            </div>
            <div className="form-group">
              <label htmlFor="register-password">Contraseña</label>
              <PasswordInput id="register-password" name="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
              <PasswordHints value={password} />
            </div>
            <label className="consent-check"><input type="checkbox" name="whatsapp" defaultChecked /> <span>Quiero recibir avisos por WhatsApp además de correo y SMS.</span></label>
            <button className="btn btn--primary" type="submit">Crear cuenta</button>
            {status && <p className="form-status" role="status">{status}</p>}
          </form>
        </div>
      </section>
    </>
  );
}
