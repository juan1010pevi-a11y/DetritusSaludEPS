import { useState } from 'react';
import { createDoctor, lookupPerson } from '../../services/api';
import { roleLabel } from '../../lib/roles';
import { DocumentInput, PasswordHints, PasswordInput, PhoneInput } from '../../components/FormFields/FormFields';

const SLOT_OPTIONS = [15, 20, 30, 40, 45, 60];
const EMPTY = { document: '', name: '', email: '', phone: '', password: '', specialty: 'Medicina general', license: '', site: '', slotMinutes: 20, alsoAffiliate: false };

/**
 * Alta de un médico por parte del administrador. Si el documento ya existe
 * (por ejemplo, un afiliado), se le agrega el perfil médico a la misma persona.
 */
export default function AddDoctorForm({ specialties, onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [person, setPerson] = useState(null); // resultado de buscar el documento
  const [state, setState] = useState({ status: 'idle', message: '' });
  const set = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const lookup = async () => {
    const document = form.document.trim();
    if (!/^\d{5,12}$/.test(document)) { setPerson(null); return; }
    try {
      setPerson(await lookupPerson(document));
    } catch {
      setPerson(null);
    }
  };

  const existing = person?.exists;
  const alreadyDoctor = existing && person.roles.includes('doctor');

  const submit = async event => {
    event.preventDefault();
    setState({ status: 'loading', message: '' });
    try {
      const data = await createDoctor({ ...form, slotMinutes: Number(form.slotMinutes) });
      setState({ status: 'success', message: '' });
      onCreated?.(data);
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  return (
    <form className="add-doctor" onSubmit={submit}>
      <div className="add-doctor__head">
        <h4>Agregar médico a la red</h4>
        <p>Primero escribe el documento: si la persona ya está registrada (por ejemplo, como afiliada), se usa la misma cuenta y solo se le agrega el perfil de médico.</p>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="doc-document">Número de documento *</label>
          <DocumentInput id="doc-document" value={form.document} required
            onChange={event => { set('document', event.target.value); setPerson(null); }}
            onBlur={lookup} />
        </div>
        {!existing && (
          <div className="form-group">
            <label htmlFor="doc-name">Nombre completo *</label>
            <input id="doc-name" value={form.name} onChange={event => set('name', event.target.value)} placeholder="Dr. Nombre Apellido" required />
          </div>
        )}
      </div>

      {existing && (
        <div className={`add-doctor__person ${alreadyDoctor ? 'is-warning' : ''}`}>
          <strong>{person.name}</strong>
          <span>Persona ya registrada · perfiles actuales: {person.roles.map(roleLabel).join(', ') || 'ninguno'}</span>
          <span>{alreadyDoctor ? 'Ya es médico: edita su horario desde la lista.' : 'Se le agregará el perfil de Médico. Ingresará con su misma contraseña.'}</span>
        </div>
      )}

      {!existing && (
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="doc-email">Correo</label>
            <input id="doc-email" type="email" value={form.email} onChange={event => set('email', event.target.value)} placeholder="medico@detritus.com" />
          </div>
          <div className="form-group">
            <label htmlFor="doc-phone">Teléfono</label>
            <PhoneInput id="doc-phone" value={form.phone} onChange={event => set('phone', event.target.value)} />
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="doc-specialty">Especialidad *</label>
          <select id="doc-specialty" value={form.specialty} onChange={event => set('specialty', event.target.value)}>
            {specialties.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="doc-license">Registro profesional (RETHUS) *</label>
          <input id="doc-license" value={form.license} onChange={event => set('license', event.target.value)} placeholder="RM 12345" required />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="doc-site">Sede / consultorio</label>
          <input id="doc-site" value={form.site} onChange={event => set('site', event.target.value)} placeholder="Sede Chapinero - Consultorio 204" />
        </div>
        <div className="form-group">
          <label htmlFor="doc-slot">Duración de cada cita</label>
          <select id="doc-slot" value={form.slotMinutes} onChange={event => set('slotMinutes', event.target.value)}>
            {SLOT_OPTIONS.map(option => <option key={option} value={option}>{option} minutos</option>)}
          </select>
        </div>
      </div>

      {!existing && (
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="doc-password">Contraseña temporal *</label>
            <PasswordInput id="doc-password" autoComplete="new-password" value={form.password} onChange={event => set('password', event.target.value)} minLength={8} placeholder="Mínimo 8 caracteres, letras y números" required />
            <PasswordHints value={form.password} />
          </div>
          <label className="schedule-editor__toggle add-doctor__check">
            <input type="checkbox" checked={form.alsoAffiliate} onChange={event => set('alsoAffiliate', event.target.checked)} />
            También es afiliado de la EPS (podrá agendar citas como paciente)
          </label>
        </div>
      )}

      {state.message && <p className="form-status form-status--error" role="alert">{state.message}</p>}
      <div className="add-doctor__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={state.status === 'loading' || alreadyDoctor}>
          {state.status === 'loading' ? 'Guardando…' : existing ? 'Agregar perfil de médico' : 'Crear médico'}
        </button>
      </div>
    </form>
  );
}
