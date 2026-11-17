import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { disableMfa, enableMfa, getClinicalAudit, getMfaStatus, getMySessions, setupMfa } from '../../services/api';
import { digitsOnly } from '../../lib/validators';

const ACTION_LABELS = {
  'clinical_history.read': 'Consultó la historia clínica',
  'clinical_history.read_own': 'El paciente consultó su historia',
  'clinical_background.update': 'Actualizó antecedentes',
  'clinical_encounter.create': 'Registró una atención',
};

const formatDateTime = value => new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** Verificación en dos pasos (TOTP) para médico y administrador. */
function TwoFactor() {
  const { updateSession } = useAuth();
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });

  const load = () => getMfaStatus().then(setStatus).catch(error => setState({ status: 'error', message: error.message }));
  useEffect(() => { load(); }, []);

  const start = async () => {
    setState({ status: 'loading', message: '' });
    try {
      setSetup(await setupMfa());
      setState({ status: 'idle', message: '' });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  const confirm = async event => {
    event.preventDefault();
    setState({ status: 'loading', message: '' });
    try {
      const data = await enableMfa(code);
      updateSession(data);
      setSetup(null);
      setCode('');
      setState({ status: 'success', message: 'Listo: desde ahora tu ingreso como médico o administrador pedirá el código de la app.' });
      load();
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  const turnOff = async event => {
    event.preventDefault();
    setState({ status: 'loading', message: '' });
    try {
      await disableMfa(code);
      setCode('');
      setState({ status: 'success', message: 'Verificación en dos pasos desactivada.' });
      load();
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  return (
    <section className="portal-card">
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Seguridad de la cuenta</span>
          <h3>Verificación en dos pasos</h3>
          <p className="portal-help">
            Tu perfil puede ver datos clínicos de muchos pacientes. Con la verificación en dos pasos, además de la contraseña
            se pide un código de 6 dígitos de una app autenticadora (Google Authenticator, Microsoft Authenticator, Authy).
          </p>
        </div>
        {status && <span className={`role-chip ${status.enabled ? 'is-on' : ''}`}>{status.enabled ? 'Activa' : 'Inactiva'}</span>}
      </div>
      {status?.required && !status.enabled && (
        <p className="form-status form-status--error">La EPS exige la verificación en dos pasos para tu perfil. Actívala para continuar.</p>
      )}
      {status && !status.enabled && !setup && (
        <button type="button" className="btn btn--primary btn--sm" onClick={start} disabled={state.status === 'loading'}>Activar verificación en dos pasos</button>
      )}
      {setup && (
        <form onSubmit={confirm} className="tramite-form" style={{ marginTop: 0 }}>
          <ol className="portal-help">
            <li>Abre tu app autenticadora y elige “Agregar cuenta” → “Ingresar clave de configuración”.</li>
            <li>Escribe esta clave (tipo “basada en tiempo”): <code style={{ userSelect: 'all', fontWeight: 700 }}>{setup.secret.match(/.{1,4}/g).join(' ')}</code></li>
            <li>Desde el celular también puedes <a href={setup.otpauthUri}>abrir este enlace</a> para agregarla directamente.</li>
            <li>Escribe el código de 6 dígitos que muestra la app.</li>
          </ol>
          <div className="form-group">
            <label htmlFor="mfa-code">Código de verificación</label>
            <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={event => setCode(digitsOnly(event.target.value, 6))} required />
          </div>
          <button className="btn btn--primary btn--sm" disabled={code.length !== 6 || state.status === 'loading'}>Confirmar y activar</button>
        </form>
      )}
      {status?.enabled && !status.required && (
        <form onSubmit={turnOff} className="tramite-form__footer">
          <input aria-label="Código actual para desactivar" placeholder="Código actual" inputMode="numeric" maxLength={6} value={code}
            onChange={event => setCode(digitsOnly(event.target.value, 6))} />
          <button className="btn btn--ghost btn--sm" disabled={code.length !== 6 || state.status === 'loading'}>Desactivar</button>
        </form>
      )}
      {state.message && <p className={`form-status form-status--${state.status}`} role="status">{state.message}</p>}
    </section>
  );
}

function Sessions() {
  const [items, setItems] = useState(null);
  useEffect(() => { getMySessions().then(data => setItems(data.items)).catch(() => setItems([])); }, []);
  if (!items) return null;
  return (
    <section className="portal-card">
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Seguridad de la cuenta</span>
          <h3>Sesiones abiertas</h3>
          <p className="portal-help">Si ves un acceso que no reconoces, cambia tu contraseña: eso cierra todas las sesiones.</p>
        </div>
      </div>
      <div className="portal-list">
        {items.map(item => (
          <article className="role-row" key={`${item.createdAt}-${item.role}`}>
            <div><strong>{formatDateTime(item.createdAt)}</strong><span>{item.userAgent || 'Navegador desconocido'}</span></div>
            <span>Vence {formatDateTime(item.expiresAt)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Auditoría de accesos a la historia clínica (Resolución 1995 de 1999). Solo administrador. */
function ClinicalAudit() {
  const [document, setDocument] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const search = async event => {
    event?.preventDefault();
    setError('');
    try {
      setItems((await getClinicalAudit(document ? { document } : {})).items);
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="portal-card">
      <div className="portal-card__head">
        <div>
          <span className="portal-label">Auditoría</span>
          <h3>Accesos a historias clínicas</h3>
          <p className="portal-help">Cada consulta o modificación de una historia clínica queda registrada con usuario, fecha, IP y resultado.</p>
        </div>
        <form onSubmit={search}>
          <input className="portal-search" placeholder="Documento del paciente" value={document} onChange={event => setDocument(digitsOnly(event.target.value, 12))} />
        </form>
      </div>
      {error && <p className="form-status form-status--error">{error}</p>}
      {items && !items.length && <p className="portal-empty">No hay accesos registrados.</p>}
      {items?.length > 0 && (
        <div className="portal-table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Perfil</th><th>Acción</th><th>Paciente</th><th>Resultado</th><th>IP</th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.occurredAt)}</td>
                  <td>{item.actorId || '—'}</td>
                  <td>{item.actorRole || '—'}</td>
                  <td>{ACTION_LABELS[item.action] || item.action}</td>
                  <td>{item.patientId || '—'}</td>
                  <td>{item.outcome === 'denied' ? 'Denegado' : 'Permitido'}</td>
                  <td>{item.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function SecurityPanel({ role, roles }) {
  const staff = roles.some(item => item === 'doctor' || item === 'administrator');
  return (
    <div className="portal-grid" style={{ marginTop: '1.5rem' }}>
      {staff && <TwoFactor />}
      <Sessions />
      {role === 'administrator' && <ClinicalAudit />}
    </div>
  );
}
