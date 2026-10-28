import { useCallback, useEffect, useState } from 'react';
import {
  AUTH_STATUS, AuthorizationDocument, CertificateDocument, FormulaDocument, groupFormulas, PRESCRIPTION_STATUS, PrintableModal,
} from '../../components/Documents/EpsDocuments';
import { createAuthorization, getAuthorizationCatalog, getMyAuthorizations, getMyPrescriptions, getProfile } from '../../services/api';
import { formatDate } from '../../lib/roles';

// ---------- Autorizaciones ----------
export function AuthorizationsPanel() {
  const [items, setItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ serviceCode: '', orderedBy: '', orderReference: '', reason: '', priority: 'normal' });
  const [state, setState] = useState({ status: 'idle', message: '' });
  const [document, setDocument] = useState(null);

  const load = useCallback(() => {
    getMyAuthorizations().then(data => setItems(data.items || [])).catch(error => setState({ status: 'error', message: error.message }));
  }, []);
  useEffect(() => { load(); getAuthorizationCatalog().then(data => setCatalog(data.items || [])).catch(() => {}); }, [load]);

  const set = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const submit = async event => {
    event.preventDefault();
    setState({ status: 'loading', message: '' });
    try {
      const data = await createAuthorization(form);
      setState({ status: 'success', message: `Solicitud ${data.authorization.id} radicada. Te responderemos en máximo 5 días hábiles.` });
      setShowForm(false);
      setForm({ serviceCode: '', orderedBy: '', orderReference: '', reason: '', priority: 'normal' });
      load();
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  return (
    <section className="portal-card">
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Trámites</span>
          <h3>Mis autorizaciones</h3>
          <p className="portal-help">Solicita la autorización de exámenes, procedimientos o consultas especializadas que te ordenó tu médico.</p>
        </div>
        {!showForm && <button type="button" className="btn btn--primary btn--sm" onClick={() => { setShowForm(true); setState({ status: 'idle', message: '' }); }}>+ Solicitar autorización</button>}
      </div>

      {showForm && (
        <form className="service-form" onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="auth-service">Servicio a autorizar *</label>
              <select id="auth-service" value={form.serviceCode} onChange={event => set('serviceCode', event.target.value)} required>
                <option value="">Selecciona el servicio de tu orden</option>
                {catalog.map(item => <option key={item.code} value={item.code}>{item.name} · {item.category}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="auth-priority">Prioridad</label>
              <select id="auth-priority" value={form.priority} onChange={event => set('priority', event.target.value)}>
                <option value="normal">Normal (hasta 5 días hábiles)</option>
                <option value="prioritaria">Prioritaria (48 horas)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="auth-doctor">Médico que ordenó *</label>
              <input id="auth-doctor" value={form.orderedBy} onChange={event => set('orderedBy', event.target.value)} placeholder="Ej. Médico demo" required />
            </div>
            <div className="form-group">
              <label htmlFor="auth-order">Número de la orden médica *</label>
              <input id="auth-order" value={form.orderReference} onChange={event => set('orderReference', event.target.value)} placeholder="Ej. ORD-2026-5521" required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="auth-reason">Motivo o diagnóstico *</label>
            <textarea id="auth-reason" value={form.reason} onChange={event => set('reason', event.target.value)} placeholder="Tal como aparece en la orden médica" required minLength="5" />
          </div>
          <div className="service-form__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Radicando…' : 'Radicar solicitud'}</button>
          </div>
        </form>
      )}
      {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}

      {!items.length && <p className="portal-empty">No tienes autorizaciones registradas.</p>}
      <div className="portal-list">
        {items.map(item => (
          <article className="lab-row" key={item.id}>
            <div>
              <strong>{item.serviceName}</strong>
              <span>{item.status === 'approved' ? `Autorización ${item.authNumber} · vigente hasta ${formatDate(item.validUntil)}` : `Solicitud ${item.id} · radicada ${formatDate(String(item.createdAt).slice(0, 10))}`}</span>
              {item.status === 'approved' && <span>{item.provider}</span>}
              {item.status === 'denied' && <span>Motivo: {item.decisionNotes}</span>}
            </div>
            <span className={`status-pill status-pill--${item.status}`}>{AUTH_STATUS[item.status] || item.status}</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDocument(item)}>{item.status === 'approved' ? 'Descargar' : 'Ver detalle'}</button>
          </article>
        ))}
      </div>
      {document && (
        <PrintableModal title="Autorización" onClose={() => setDocument(null)} canPrint={document.status === 'approved'}>
          <AuthorizationDocument item={document} />
        </PrintableModal>
      )}
    </section>
  );
}

// ---------- Medicamentos ----------
export function MedicationsPanel() {
  const [formulas, setFormulas] = useState([]);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getMyPrescriptions().then(data => setFormulas(groupFormulas(data.items || []))).catch(error => setMessage(error.message));
  }, []);

  return (
    <section className="portal-card">
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Farmacia</span>
          <h3>Mis medicamentos</h3>
          <p className="portal-help">Aquí aparecen las fórmulas que te emiten tus médicos después de cada consulta, con su estado y el punto donde puedes reclamarlas.</p>
        </div>
      </div>
      {message && <p className="form-status form-status--error">{message}</p>}
      {!formulas.length && !message && <p className="portal-empty">No tienes fórmulas médicas.</p>}
      <div className="portal-list">
        {formulas.map(formula => (
          <article className="formula-row" key={formula.formulaNumber}>
            <div className="formula-row__head">
              <div>
                <strong>Fórmula {formula.formulaNumber}</strong>
                <span>{formatDate(formula.items[0].issuedAt)} · {formula.items[0].doctorName || 'Médico tratante'}</span>
              </div>
              <span className={`status-pill status-pill--${formula.status}`}>{PRESCRIPTION_STATUS[formula.status] || formula.status}</span>
            </div>
            <ul className="formula-row__items">
              {formula.items.map(item => <li key={item.id}><strong>{item.medication}</strong> · {item.dosage} · {item.quantity} und.</li>)}
            </ul>
            <div className="formula-row__foot">
              <span>{formula.status === 'pending' ? 'La farmacia está alistando tu pedido.' : formula.status === 'available' ? `Reclama en: ${formula.items[0].deliveryPoint}` : `Entregada en: ${formula.items[0].deliveryPoint}`}</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(formula)}>Ver fórmula</button>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <PrintableModal title="Fórmula médica" onClose={() => setSelected(null)}>
          <FormulaDocument formula={selected} />
        </PrintableModal>
      )}
    </section>
  );
}

// ---------- Certificado ----------
export function CertificatePanel({ user }) {
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getProfile(user.document).then(setProfile).catch(error => setMessage(error.message));
  }, [user.document]);

  return (
    <section className="portal-card">
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Certificados</span>
          <h3>Certificado de afiliación</h3>
          <p className="portal-help">Documento oficial que acredita tu afiliación activa. Lo piden empleadores, universidades, bancos y otras entidades.</p>
        </div>
      </div>
      {message && <p className="form-status form-status--error">{message}</p>}
      {profile && (
        <div className="certificate-summary">
          <div><span>Afiliado</span><strong>{profile.name}</strong></div>
          <div><span>Documento</span><strong>{profile.document}</strong></div>
          <div><span>Régimen</span><strong>{profile.plan}</strong></div>
          <div><span>Estado</span><strong className={profile.status === 'active' ? 'is-active' : ''}>{profile.status === 'active' ? 'Activo' : 'Inactivo'}</strong></div>
          <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>Generar certificado</button>
        </div>
      )}
      {open && profile && (
        <PrintableModal title="Certificado de afiliación" onClose={() => setOpen(false)}>
          <CertificateDocument profile={profile} />
        </PrintableModal>
      )}
    </section>
  );
}
