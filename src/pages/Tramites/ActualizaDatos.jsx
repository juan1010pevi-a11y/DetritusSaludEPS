import { useEffect, useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import { PhoneInput } from '../../components/FormFields/FormFields';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile } from '../../services/api';
import { emailError, nameError, phoneError } from '../../lib/validators';
import './ActualizaDatos.css';

export default function ActualizaDatos() {
  const { user, openLogin } = useAuth();
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    if (!user) return;
    getProfile(user.document)
      .then(profile => setForm({
        name: profile.name || '', email: profile.email || '', phone: profile.phone || '',
        address: profile.address || '', whatsappOptIn: Boolean(profile.whatsappOptIn),
      }))
      .catch(error => setState({ status: 'error', message: error.message }));
  }, [user]);

  const handleSubmit = async event => {
    event.preventDefault();
    const problem = nameError(form.name) || emailError(form.email) || phoneError(form.phone)
      || (form.address && form.address.trim().length < 5 ? 'La dirección es muy corta.' : null);
    if (problem) { setState({ status: 'error', message: problem }); return; }
    setState({ status: 'loading', message: '' });
    try {
      await updateProfile(form);
      setState({ status: 'success', message: 'Datos actualizados. Las notificaciones de citas, PQRS y demás trámites llegarán a estos datos de contacto.' });
    } catch (error) {
      setState({ status: 'error', message: error.message || 'No fue posible actualizar los datos.' });
    }
  };

  const set = (field, value) => setForm(current => ({ ...current, [field]: value }));

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
          { label: 'Actualiza tus datos' },
        ]}
      />
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header"><span className="section-label">Información del afiliado</span><h2 className="section-heading">Mantén tus datos al día</h2><p className="tramite-content__intro">Actualiza tus datos de contacto para recibir por correo, SMS y WhatsApp las confirmaciones de citas, respuestas de PQRS, autorizaciones y resultados.</p></div>
          {!user && (
            <div className="info-card tramite-form">
              <h2>Ingresa para continuar</h2>
              <p className="tramite-form__intro">Por seguridad, solo el titular puede cambiar sus datos de contacto.</p>
              <button type="button" className="btn btn--primary" onClick={() => openLogin({ role: 'affiliate', redirect: '/tramites/actualiza-datos' })}>Ingresar</button>
            </div>
          )}
          {user && !form && <p className="form-status">{state.message || 'Cargando tus datos…'}</p>}
          {user && form && (
            <form className="info-card tramite-form" onSubmit={handleSubmit}>
              <h2>Actualización de datos</h2>
              <p className="tramite-form__intro">Documento: {user.document}</p>
              <div className="form-row">
                <div className="form-group"><label htmlFor="update-name">Nombre completo</label><input id="update-name" value={form.name} maxLength={120} onChange={event => set('name', event.target.value)} required /></div>
                <div className="form-group"><label htmlFor="update-phone">Celular</label><PhoneInput id="update-phone" value={form.phone} onChange={event => set('phone', event.target.value)} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label htmlFor="update-email">Correo electrónico</label><input id="update-email" type="email" value={form.email} maxLength={120} onChange={event => set('email', event.target.value)} required /></div>
                <div className="form-group"><label htmlFor="update-address">Dirección</label><input id="update-address" value={form.address} maxLength={160} placeholder="Calle, número, barrio" onChange={event => set('address', event.target.value)} /></div>
              </div>
              <label className="consent-check"><input type="checkbox" checked={form.whatsappOptIn} onChange={event => set('whatsappOptIn', event.target.checked)} /> <span>Recibir avisos por WhatsApp además de correo y SMS.</span></label>
              <button className="btn btn--primary" type="submit" disabled={state.status === 'loading'}>Guardar cambios</button>
              {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
            </form>
          )}
        </div>
      </section>
    </>
  );
}
