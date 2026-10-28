import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../Modal/Modal';
import { DocumentInput, PasswordHints, PasswordInput } from '../FormFields/FormFields';
import { useAuth } from '../../context/AuthContext';
import { forgotPassword, resetPassword } from '../../services/api';
import { ROLE_ORDER, ROLES, RoleIcon } from '../../lib/roles';
import { codeError, digitsOnly, documentError, passwordError } from '../../lib/validators';
import './LoginModal.css';

// Cuentas académicas de prueba (ver backend/README.md). La contraseña no se muestra:
// al elegir la cuenta se llena el formulario con la contraseña oculta.
const DEMO_ACCOUNTS = {
  affiliate: [{ document: '123456789', password: 'demo123', label: 'Afiliado demo' }],
  doctor: [
    { document: '900000001', password: 'doctor123', label: 'Médico demo · Medicina general' },
    { document: '900000008', password: 'medico123', label: 'Dr. Andrés Rojas · Medicina general' },
    { document: '900000007', password: 'medico123', label: 'Bact. Sandra Ruiz · Laboratorio' },
    { document: '1010101010', password: 'demo123', label: 'Laura Gómez · afiliada y médica' },
  ],
  administrator: [{ document: '900000002', password: 'admin123', label: 'Administrador demo' }],
};

const loginDocumentType = value => (/[A-Za-z]/.test(value) ? 'PA' : 'CC');

/** "¿Olvidaste tu contraseña?": documento → código de 6 dígitos → nueva contraseña. */
function ForgotPassword({ initialDocument, role, onBack, onDone }) {
  const [step, setStep] = useState('request');
  const [document, setDocument] = useState(initialDocument || '');
  const [form, setForm] = useState({ code: '', password: '', passwordConfirm: '' });
  const [info, setInfo] = useState(null);
  const [state, setState] = useState({ status: 'idle', message: '' });

  const request = async event => {
    event?.preventDefault();
    const problem = documentError(document, loginDocumentType(document));
    if (problem) { setState({ status: 'error', message: problem }); return; }
    setState({ status: 'loading', message: '' });
    try {
      const data = await forgotPassword(document);
      setInfo(data);
      setStep('reset');
      setState({ status: 'idle', message: '' });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  const reset = async event => {
    event.preventDefault();
    const problem = codeError(form.code) || passwordError(form.password)
      || (form.password !== form.passwordConfirm ? 'Las contraseñas no coinciden.' : null);
    if (problem) { setState({ status: 'error', message: problem }); return; }
    setState({ status: 'loading', message: '' });
    try {
      const data = await resetPassword({ document, ...form });
      onDone(document, data.message);
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  return (
    <div className={`login role-${role}`}>
      <span className="section-label">Recuperar acceso</span>
      <h2 className="login__title">¿Olvidaste tu contraseña?</h2>
      {step === 'request' && (
        <form onSubmit={request} className="login__form" noValidate>
          <p className="login__role-help">Escribe tu número de documento. Te enviaremos un código de verificación al correo y al celular que registraste.</p>
          <div className="form-group">
            <label htmlFor="forgot-document">Número de documento</label>
            <DocumentInput id="forgot-document" documentType={loginDocumentType(document)} value={document}
              onChange={event => setDocument(event.target.value)} required autoFocus />
          </div>
          {state.message && <p className="login__error" role="alert">{state.message}</p>}
          <button className="btn btn--primary login__submit" disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      )}
      {step === 'reset' && (
        <form onSubmit={reset} className="login__form" noValidate>
          <p className="login__notice login__notice--ok">{info?.message}</p>
          {info?.demoCode && (
            <p className="login__demo-code">
              Modo demostración (sin correo real configurado): tu código es <strong>{info.demoCode}</strong>
            </p>
          )}
          <div className="form-group">
            <label htmlFor="reset-code">Código de verificación</label>
            <input id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 dígitos" value={form.code}
              onChange={event => setForm({ ...form, code: digitsOnly(event.target.value, 6) })} required />
          </div>
          <div className="form-group">
            <label htmlFor="reset-password">Nueva contraseña</label>
            <PasswordInput id="reset-password" autoComplete="new-password" value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })} required />
            <PasswordHints value={form.password} />
          </div>
          <div className="form-group">
            <label htmlFor="reset-confirm">Confirma la nueva contraseña</label>
            <PasswordInput id="reset-confirm" autoComplete="new-password" value={form.passwordConfirm}
              onChange={event => setForm({ ...form, passwordConfirm: event.target.value })} required />
          </div>
          {state.message && <p className="login__error" role="alert">{state.message}</p>}
          <button className="btn btn--primary login__submit" disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
          <button type="button" className="login__link" onClick={() => request()} disabled={state.status === 'loading'}>Reenviar código</button>
        </form>
      )}
      <button type="button" className="login__link" onClick={onBack}>← Volver a ingresar</button>
    </div>
  );
}

export default function LoginModal() {
  const { loginModal, closeLogin, login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState(loginModal?.role || 'affiliate');
  const [view, setView] = useState('login');
  const [form, setForm] = useState({ document: '', password: '' });
  const [state, setState] = useState({ status: 'idle', message: '' });
  const [notice, setNotice] = useState(loginModal?.notice || '');

  const handleSubmit = async event => {
    event.preventDefault();
    const document = form.document.trim();
    const problem = documentError(document, loginDocumentType(document)) || (!form.password ? 'Escribe tu contraseña.' : null);
    if (problem) { setState({ status: 'error', message: problem }); return; }
    setState({ status: 'loading', message: '' });
    try {
      await login(document, form.password, role);
      const redirect = loginModal?.redirect;
      closeLogin();
      if (redirect) navigate(redirect);
    } catch (error) {
      setState({ status: 'error', message: error.message || 'No fue posible iniciar sesión.' });
    }
  };

  const fillDemo = account => {
    setForm({ document: account.document, password: account.password });
    setState({ status: 'idle', message: '' });
  };

  if (view === 'forgot') {
    return (
      <Modal title="Recuperar contraseña" onClose={closeLogin}>
        <ForgotPassword
          initialDocument={form.document}
          role={role}
          onBack={() => setView('login')}
          onDone={(document, message) => {
            setForm({ document, password: '' });
            setNotice(message);
            setState({ status: 'idle', message: '' });
            setView('login');
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal title="Ingresar" onClose={closeLogin}>
      <div className={`login role-${role}`}>
        <span className="section-label">Detritus Salud E.P.S.</span>
        <h2 className="login__title">Ingresa a tu cuenta</h2>
        {notice && <p className="login__notice">{notice}</p>}

        <div className="login__roles" role="tablist" aria-label="Perfil de ingreso">
          {ROLE_ORDER.map(key => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={role === key}
              className={`login__role role-${key} ${role === key ? 'is-active' : ''}`}
              onClick={() => { setRole(key); setState({ status: 'idle', message: '' }); }}
            >
              <RoleIcon role={key} />
              <span>{ROLES[key].label}</span>
            </button>
          ))}
        </div>
        <p className="login__role-help">{ROLES[role].description}</p>

        <form onSubmit={handleSubmit} className="login__form" noValidate>
          <div className="form-group">
            <label htmlFor="login-document">Número de documento</label>
            <DocumentInput id="login-document" documentType={loginDocumentType(form.document)} autoComplete="username" value={form.document}
              onChange={event => setForm({ ...form, document: event.target.value })} required />
            <small className="field-hint">Solo números, sin puntos ni espacios.</small>
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Contraseña</label>
            <PasswordInput id="login-password" autoComplete="current-password" value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })} placeholder="••••••••" required />
          </div>
          {state.message && <p className="login__error" role="alert">{state.message}</p>}
          <button className="btn btn--primary login__submit" disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Validando…' : `Ingresar como ${ROLES[role].label.toLowerCase()}`}
          </button>
          <button type="button" className="login__link" onClick={() => { setView('forgot'); setNotice(''); }}>¿Olvidaste tu contraseña?</button>
        </form>

        <details className="login__demo">
          <summary>Cuentas de prueba</summary>
          <ul>
            {DEMO_ACCOUNTS[role].map(account => (
              <li key={account.document}>
                <button type="button" onClick={() => fillDemo(account)}>
                  <strong>{account.label}</strong>
                  <span>Documento {account.document} · contraseña oculta (se llena al elegirla)</span>
                </button>
              </li>
            ))}
          </ul>
        </details>

        {role === 'affiliate' && (
          <p className="login__footer">¿Aún no tienes cuenta? <Link to="/tramites/afiliacion-contributivo" onClick={closeLogin}>Regístrate</Link></p>
        )}
        {role !== 'affiliate' && (
          <p className="login__footer">Los perfiles de médico y administrador los asigna la EPS. Si eres afiliado y médico, usa el mismo documento y contraseña.</p>
        )}
      </div>
    </Modal>
  );
}
