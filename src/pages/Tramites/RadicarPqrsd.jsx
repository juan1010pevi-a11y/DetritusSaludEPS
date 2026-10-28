import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import Alert from '../../components/Alert/Alert';
import { DocumentInput, PhoneInput } from '../../components/FormFields/FormFields';
import { useAuth } from '../../context/AuthContext';
import { createPqrs } from '../../services/api';
import { formatLongDate } from '../../lib/roles';
import { documentError, emailError, maskContact, nameError, phoneError } from '../../lib/validators';
import './RadicarPqrsd.css';

const TYPES = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Denuncia'];

export default function RadicarPqrsd() {
  const { user } = useAuth();
  const [documentType, setDocumentType] = useState('CC');
  const [state, setState] = useState({ status: 'idle', message: '' });
  const [result, setResult] = useState(null);
  const [length, setLength] = useState(0);

  const handleSubmit = async event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const data = {
      type: form.get('type'),
      subject: String(form.get('subject') || '').trim(),
      name: String(form.get('name') || '').trim(),
      documentType,
      document: String(form.get('document') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      description: String(form.get('description') || '').trim(),
      acceptDataPolicy: form.get('consent') === 'on',
    };
    const problem = nameError(data.name) || documentError(data.document, documentType) || emailError(data.email) || phoneError(data.phone)
      || (data.description.length < 20 ? 'Describe tu solicitud con al menos 20 caracteres.' : null);
    if (problem) { setState({ status: 'error', message: problem }); return; }
    setState({ status: 'loading', message: '' });
    try {
      const response = await createPqrs(data);
      setResult({ ...response.request, notified: response.notified });
      setState({ status: 'idle', message: '' });
      formElement.reset();
      setLength(0);
    } catch (error) {
      setState({ status: 'error', message: error.message || 'No fue posible radicar la solicitud.' });
    }
  };

  return (
    <>
      <PageHero label="Trámites en línea" title="Radicar una PQRSD" description="Presenta una petición, queja, reclamo, sugerencia o denuncia." image="/img/estado-pqrsd.jpg" breadcrumb={[{ label: 'Trámites', path: '/tramites' }, { label: 'Radicar PQRSD' }]} />
      <section className="content-section">
        <div className="container pqrs-submit-layout">
          {result ? (
            <div className="info-card pqrs-submit-form pqrs-receipt" role="status">
              <span className="section-label">Solicitud radicada</span>
              <h2>Tu radicado es {result.id}</h2>
              <p>Guárdalo: con este número y tu documento puedes consultar el estado en “Estado de tus PQRSD”.</p>
              <ul>
                <li><strong>Tipo:</strong> {result.type} · {result.subject}</li>
                <li><strong>Fecha límite de respuesta:</strong> {formatLongDate(result.dueDate)}</li>
                <li><strong>Confirmación enviada a:</strong> {maskContact(result.email)} y al celular {maskContact(result.phone)} (SMS y WhatsApp)</li>
              </ul>
              <button type="button" className="btn btn--primary" onClick={() => setResult(null)}>Radicar otra solicitud</button>
            </div>
          ) : (
            <form className="info-card pqrs-submit-form" onSubmit={handleSubmit}>
              <h2>Cuéntanos tu solicitud</h2>
              <p className="pqrs-submit-form__intro">Diligencia la información para que podamos revisar y responder tu caso. Te enviaremos la confirmación y la respuesta por correo, SMS y WhatsApp.</p>
              <div className="form-row">
                <div className="form-group"><label htmlFor="pqrs-type">Tipo de solicitud *</label><select id="pqrs-type" name="type" defaultValue="" required><option value="" disabled>Selecciona una opción</option>{TYPES.map(type => <option key={type}>{type}</option>)}</select></div>
                <div className="form-group"><label htmlFor="pqrs-subject">Asunto *</label><input id="pqrs-subject" name="subject" type="text" placeholder="Motivo de tu solicitud" minLength={5} maxLength={120} required /></div>
              </div>
              <div className="form-group"><label htmlFor="pqrs-name">Nombre completo *</label><input id="pqrs-name" name="name" type="text" placeholder="Tu nombre y apellidos" defaultValue={user?.name || ''} maxLength={120} required /></div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pqrs-document-type">Tipo de documento *</label>
                  <select id="pqrs-document-type" value={documentType} onChange={event => setDocumentType(event.target.value)}>
                    <option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="TI">Tarjeta de identidad</option><option value="PA">Pasaporte</option><option value="PPT">PPT</option>
                  </select>
                </div>
                <div className="form-group"><label htmlFor="pqrs-document">Número de documento *</label><DocumentInput id="pqrs-document" name="document" documentType={documentType} defaultValue={user?.document || ''} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label htmlFor="pqrs-email">Correo electrónico *</label><input id="pqrs-email" name="email" type="email" placeholder="correo@ejemplo.com" maxLength={120} required /></div>
                <div className="form-group"><label htmlFor="pqrs-phone">Celular *</label><PhoneInput id="pqrs-phone" name="phone" required /></div>
              </div>
              <div className="form-group">
                <label htmlFor="pqrs-description">Describe tu solicitud *</label>
                <textarea id="pqrs-description" name="description" placeholder="Escribe los detalles de tu caso (mínimo 20 caracteres)…" minLength={20} maxLength={3000} required onChange={event => setLength(event.target.value.length)} />
                <small className="field-hint">{length}/3000 caracteres</small>
              </div>
              <label className="pqrs-consent"><input type="checkbox" name="consent" required /><span>Autorizo el tratamiento de mis datos para gestionar esta solicitud (Ley 1581 de 2012).</span></label>
              {state.message && <p className={`form-status form-status--${state.status}`} role="alert">{state.message}</p>}
              <button className="btn btn--primary" type="submit" disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Radicando…' : 'Enviar PQRSD'}</button>
            </form>
          )}
          <aside className="pqrs-submit-aside"><div className="pqrs-submit-note"><span className="pqrs-submit-note__label">Después de enviar</span><h3>Recibirás un radicado</h3><p>Con tu número de radicado y tu documento podrás consultar el avance de la solicitud en cualquier momento.</p><ul><li>Conserva el número de radicado.</li><li>Te avisaremos por correo, SMS y WhatsApp cada cambio de estado.</li><li>Peticiones, quejas y reclamos: hasta 15 días hábiles. Denuncias: hasta 30.</li></ul></div><Alert type="info">Para consultar una solicitud existente, usa la opción “Consultar estado de PQRSD”.</Alert></aside>
        </div>
      </section>
    </>
  );
}
