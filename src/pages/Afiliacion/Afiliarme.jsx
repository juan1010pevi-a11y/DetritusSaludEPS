import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHero from '../../components/PageHero/PageHero';
import Alert from '../../components/Alert/Alert';
import { useAuth } from '../../context/AuthContext';
import { createAffiliation } from '../../services/api';
import { formatLongDate, todayBogota } from '../../lib/roles';
import './Afiliarme.css';
import { DocumentInput, PasswordHints, PasswordInput } from '../../components/FormFields/FormFields';

const STEPS = ['Tipo de afiliación', 'Datos personales', 'Ubicación y contacto', 'Información laboral', 'Grupo familiar', 'Acceso y declaraciones'];

const DOCUMENT_TYPES = [
  ['CC', 'Cédula de ciudadanía'], ['CE', 'Cédula de extranjería'], ['PA', 'Pasaporte'], ['PPT', 'Permiso por Protección Temporal'],
  ['TI', 'Tarjeta de identidad'], ['RC', 'Registro civil'],
];
const RELATIONSHIPS = ['Cónyuge o compañero(a) permanente', 'Hijo(a)', 'Hijo(a) del cónyuge', 'Padre o madre'];
const LOCATIONS = {
  'Bogotá D.C.': ['Bogotá'],
  Cundinamarca: ['Soacha', 'Chía', 'Zipaquirá', 'Facatativá', 'Fusagasugá', 'Mosquera'],
  Antioquia: ['Medellín', 'Bello', 'Envigado', 'Itagüí', 'Rionegro'],
  'Valle del Cauca': ['Cali', 'Palmira', 'Buenaventura', 'Tuluá'],
  Atlántico: ['Barranquilla', 'Soledad', 'Malambo'],
  Santander: ['Bucaramanga', 'Floridablanca', 'Girón'],
  Boyacá: ['Tunja', 'Duitama', 'Sogamoso'],
};
const IPS_OPTIONS = [
  'Sede Chapinero - Cra. 13 # 54-20',
  'Sede Suba - Av. Suba # 115-40',
  'Sede Kennedy - Av. 1 de Mayo # 70-15',
];
const PREVIOUS_EPS = ['Ninguna (primera afiliación)', 'Nueva EPS', 'Sanitas', 'Sura', 'Compensar', 'Famisanar', 'Salud Total', 'Coosalud', 'Mutual Ser', 'Otra'];
const SISBEN = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', ...Array.from({ length: 18 }, (_, i) => `C${i + 1}`)];

const INITIAL = {
  regime: 'contributivo', affiliateType: 'dependiente',
  documentType: 'CC', document: '', firstName: '', secondName: '', firstSurname: '', secondSurname: '', birthDate: '', sex: '',
  department: 'Bogotá D.C.', city: 'Bogotá', zone: 'urbana', address: '', neighborhood: '', phone: '', landline: '', email: '', primaryIps: IPS_OPTIONS[0],
  employerName: '', employerNit: '', baseIncome: '', economicActivity: '', pensionFund: '', sisbenGroup: '', previousEps: PREVIOUS_EPS[0],
  beneficiaries: [],
  password: '', passwordConfirm: '', acceptDataPolicy: false, acceptTruthfulness: false, declareNoOtherEps: false,
};

const money = value => {
  const digits = String(value).replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('es-CO') : '';
};

function ageFrom(date) {
  if (!date) return null;
  const today = todayBogota();
  const [y, m, d] = date.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export default function Afiliarme() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(INITIAL);
  const [state, setState] = useState({ status: 'idle', message: '' });
  const [result, setResult] = useState(null);

  const set = (field, value) => setData(current => ({ ...current, [field]: value }));
  const setBeneficiary = (index, field, value) => setData(current => ({
    ...current,
    beneficiaries: current.beneficiaries.map((person, i) => (i === index ? { ...person, [field]: value } : person)),
  }));
  const goTo = next => { setStep(next); setState({ status: 'idle', message: '' }); window.scrollTo({ top: 260, behavior: 'smooth' }); };

  const next = event => {
    event.preventDefault();
    if (step === 1 && ageFrom(data.birthDate) < 18) {
      setState({ status: 'error', message: 'El titular debe ser mayor de edad. Los menores se afilian como beneficiarios de un adulto (paso 5).' });
      return;
    }
    if (step < STEPS.length - 1) { goTo(step + 1); return; }
    submit();
  };

  const submit = async () => {
    setState({ status: 'loading', message: '' });
    try {
      const response = await createAffiliation({ ...data, baseIncome: String(data.baseIncome).replace(/\D/g, '') });
      setResult(response);
      try { await login(data.document.trim(), data.password, 'affiliate'); } catch { /* el afiliado puede ingresar después */ }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  };

  const isContributive = data.regime === 'contributivo';

  if (result) {
    return (
      <>
        <PageHero label="Afiliación en línea" title="¡Bienvenido a Detritus Salud!" description="Tu solicitud de afiliación quedó radicada." />
        <section className="content-section">
          <div className="container">
            <div className="info-card affiliation-done">
              <span className="booking-success__check" aria-hidden="true">✓</span>
              <h2>Afiliación radicada</h2>
              <p>{result.linked ? 'Vinculamos tu afiliación a tu cuenta de profesional de la EPS.' : 'Validamos tus datos con la Base de Datos Única de Afiliados (BDUA).'}</p>
              <dl className="booking-success__details">
                <div><dt>Número de radicado</dt><dd>{result.filingNumber}</dd></div>
                <div><dt>Afiliado</dt><dd>{result.name}</dd></div>
                <div><dt>Régimen</dt><dd>{result.plan}</dd></div>
                <div><dt>Servicios desde</dt><dd>{formatLongDate(result.effectiveDate)}</dd></div>
                <div><dt>IPS primaria</dt><dd>{result.primaryIps}</dd></div>
                <div><dt>Beneficiarios inscritos</dt><dd>{result.beneficiaries}</dd></div>
              </dl>
              <Alert type="info">
                Guarda tu número de radicado. Desde tu portal puedes agendar citas, descargar tu certificado de afiliación y consultar autorizaciones.
                {isContributive && ' Recuerda que tus aportes se pagan mensualmente a través de la PILA.'}
              </Alert>
              <div className="booking-success__actions">
                {user ? <Link to="/portal" className="btn btn--primary">Ir a mi portal</Link> : <button type="button" className="btn btn--primary" onClick={() => navigate('/portal')}>Ingresar a mi portal</button>}
                <Link to="/tramites/certificado" className="btn btn--ghost">Descargar certificado</Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero
        label="Afiliación en línea"
        title="Afíliate a Detritus Salud"
        description="Diligencia el Formulario Único de Afiliación. Toma unos 5 minutos y quedas afiliado de inmediato."
        breadcrumb={[{ label: 'Afiliados', path: '/afiliados' }, { label: 'Afiliarme' }]}
      />
      <section className="content-section">
        <div className="container affiliation-layout">
          <div>
            <ol className="affiliation-steps">
              {STEPS.map((label, index) => (
                <li key={label} className={index === step ? 'is-current' : index < step ? 'is-done' : ''}>
                  <button type="button" disabled={index > step} onClick={() => goTo(index)}>
                    <span>{index < step ? '✓' : index + 1}</span>{label}
                  </button>
                </li>
              ))}
            </ol>

            <form className="info-card affiliation-form" onSubmit={next}>
              <h2>{step + 1}. {STEPS[step]}</h2>

              {step === 0 && (
                <>
                  <p className="affiliation-form__intro">Elige el régimen que te corresponde según tu situación.</p>
                  <div className="regime-options">
                    <button type="button" className={`regime-option ${isContributive ? 'is-active' : ''}`} onClick={() => setData(c => ({ ...c, regime: 'contributivo', affiliateType: c.affiliateType === 'cabeza_familia' ? 'dependiente' : c.affiliateType }))}>
                      <strong>Régimen contributivo</strong>
                      <span>Tienes contrato laboral, eres independiente con ingresos o pensionado. Pagas aportes mensuales (PILA).</span>
                    </button>
                    <button type="button" className={`regime-option ${!isContributive ? 'is-active' : ''}`} onClick={() => setData(c => ({ ...c, regime: 'subsidiado', affiliateType: 'cabeza_familia' }))}>
                      <strong>Régimen subsidiado</strong>
                      <span>No tienes capacidad de pago y estás clasificado en el SISBÉN IV (grupos A, B o C). El Estado cubre tu afiliación.</span>
                    </button>
                  </div>
                  {isContributive && (
                    <div className="form-group">
                      <label>Tipo de cotizante *</label>
                      <div className="choice-row">
                        {[['dependiente', 'Trabajador dependiente', 'Con contrato laboral; tu empleador hace los aportes.'],
                          ['independiente', 'Trabajador independiente', 'Prestación de servicios o actividad propia.'],
                          ['pensionado', 'Pensionado', 'Recibes una mesada pensional.']].map(([value, label, help]) => (
                          <label key={value} className={`choice ${data.affiliateType === value ? 'is-active' : ''}`}>
                            <input type="radio" name="affiliateType" value={value} checked={data.affiliateType === value} onChange={() => set('affiliateType', value)} />
                            <strong>{label}</strong><span>{help}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="previous-eps">EPS anterior</label>
                    <select id="previous-eps" value={data.previousEps} onChange={event => set('previousEps', event.target.value)}>
                      {PREVIOUS_EPS.map(item => <option key={item}>{item}</option>)}
                    </select>
                    <small className="affiliation-help">Si vienes de otra EPS y llevas más de 360 días en ella, esto es un traslado y se hará efectivo el primer día del mes siguiente.</small>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <p className="affiliation-form__intro">Escribe tus datos tal como aparecen en tu documento de identidad.</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="doc-type">Tipo de documento *</label>
                      <select id="doc-type" value={data.documentType} onChange={event => set('documentType', event.target.value)} required>
                        {DOCUMENT_TYPES.slice(0, 4).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="doc-number">Número de documento *</label>
                      <DocumentInput id="doc-number" documentType={data.documentType} value={data.document} onChange={event => set('document', event.target.value)} required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label htmlFor="first-name">Primer nombre *</label><input id="first-name" value={data.firstName} onChange={event => set('firstName', event.target.value)} required /></div>
                    <div className="form-group"><label htmlFor="second-name">Segundo nombre</label><input id="second-name" value={data.secondName} onChange={event => set('secondName', event.target.value)} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label htmlFor="first-surname">Primer apellido *</label><input id="first-surname" value={data.firstSurname} onChange={event => set('firstSurname', event.target.value)} required /></div>
                    <div className="form-group"><label htmlFor="second-surname">Segundo apellido</label><input id="second-surname" value={data.secondSurname} onChange={event => set('secondSurname', event.target.value)} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="birth-date">Fecha de nacimiento *</label>
                      <input id="birth-date" type="date" max={todayBogota()} value={data.birthDate} onChange={event => set('birthDate', event.target.value)} required />
                      {data.birthDate && <small className="affiliation-help">{ageFrom(data.birthDate)} años</small>}
                    </div>
                    <div className="form-group">
                      <label htmlFor="sex">Sexo *</label>
                      <select id="sex" value={data.sex} onChange={event => set('sex', event.target.value)} required>
                        <option value="">Selecciona</option><option value="F">Femenino</option><option value="M">Masculino</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <p className="affiliation-form__intro">Con tu lugar de residencia te asignamos la IPS donde recibirás atención primaria.</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="department">Departamento *</label>
                      <select id="department" value={data.department} onChange={event => setData(c => ({ ...c, department: event.target.value, city: LOCATIONS[event.target.value][0] }))}>
                        {Object.keys(LOCATIONS).map(item => <option key={item}>{item}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="city">Municipio *</label>
                      <select id="city" value={data.city} onChange={event => set('city', event.target.value)}>
                        {LOCATIONS[data.department].map(item => <option key={item}>{item}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label htmlFor="address">Dirección de residencia *</label><input id="address" value={data.address} onChange={event => set('address', event.target.value)} placeholder="Calle 45 # 12-30 apto 301" required minLength="5" /></div>
                    <div className="form-group"><label htmlFor="neighborhood">Barrio</label><input id="neighborhood" value={data.neighborhood} onChange={event => set('neighborhood', event.target.value)} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="zone">Zona *</label>
                      <select id="zone" value={data.zone} onChange={event => set('zone', event.target.value)}><option value="urbana">Urbana</option><option value="rural">Rural</option></select>
                    </div>
                    <div className="form-group"><label htmlFor="landline">Teléfono fijo</label><input id="landline" type="tel" value={data.landline} onChange={event => set('landline', event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="6011234567" /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label htmlFor="phone">Celular *</label><input id="phone" type="tel" value={data.phone} onChange={event => set('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} pattern="3\d{9}" title="10 dígitos, empieza por 3" placeholder="3001234567" required /></div>
                    <div className="form-group"><label htmlFor="email">Correo electrónico *</label><input id="email" type="email" value={data.email} onChange={event => set('email', event.target.value)} placeholder="correo@ejemplo.com" required /></div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="ips">IPS primaria *</label>
                    <select id="ips" value={data.primaryIps} onChange={event => set('primaryIps', event.target.value)}>
                      {IPS_OPTIONS.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                </>
              )}

              {step === 3 && isContributive && data.affiliateType === 'dependiente' && (
                <>
                  <p className="affiliation-form__intro">Datos de tu empleador. Él realiza los aportes a salud (12,5% del salario: 8,5% empleador y 4% trabajador).</p>
                  <div className="form-row">
                    <div className="form-group"><label htmlFor="employer">Razón social del empleador *</label><input id="employer" value={data.employerName} onChange={event => set('employerName', event.target.value)} required /></div>
                    <div className="form-group"><label htmlFor="nit">NIT *</label><input id="nit" value={data.employerNit} onChange={event => set('employerNit', event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9001234567" pattern="\d{9,10}" title="9 o 10 dígitos" required /></div>
                  </div>
                  <div className="form-group"><label htmlFor="income">Salario mensual (ingreso base de cotización) *</label><input id="income" inputMode="numeric" value={money(data.baseIncome)} onChange={event => set('baseIncome', event.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={14} placeholder="$ 0" required /></div>
                </>
              )}
              {step === 3 && isContributive && data.affiliateType === 'independiente' && (
                <>
                  <p className="affiliation-form__intro">Como independiente cotizas sobre el 40% de tus ingresos mensuales y pagas tus aportes por la PILA.</p>
                  <div className="form-group"><label htmlFor="activity">Actividad económica u ocupación *</label><input id="activity" value={data.economicActivity} onChange={event => set('economicActivity', event.target.value)} placeholder="Ej. Consultoría en ingeniería" required /></div>
                  <div className="form-group">
                    <label htmlFor="income">Ingreso mensual *</label>
                    <input id="income" inputMode="numeric" value={money(data.baseIncome)} onChange={event => set('baseIncome', event.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={14} placeholder="$ 0" required />
                    {data.baseIncome && <small className="affiliation-help">Ingreso base de cotización (40%): $ {money(Math.round(Number(String(data.baseIncome).replace(/\D/g, '')) * 0.4))}</small>}
                  </div>
                </>
              )}
              {step === 3 && isContributive && data.affiliateType === 'pensionado' && (
                <>
                  <p className="affiliation-form__intro">El aporte a salud se descuenta directamente de tu mesada pensional.</p>
                  <div className="form-group"><label htmlFor="pension">Entidad que paga la pensión *</label><input id="pension" value={data.pensionFund} onChange={event => set('pensionFund', event.target.value)} placeholder="Ej. Colpensiones, Porvenir, Protección" required /></div>
                </>
              )}
              {step === 3 && !isContributive && (
                <>
                  <p className="affiliation-form__intro">Para el régimen subsidiado validamos tu clasificación en el SISBÉN IV.</p>
                  <div className="form-group">
                    <label htmlFor="sisben">Grupo SISBÉN IV *</label>
                    <select id="sisben" value={data.sisbenGroup} onChange={event => set('sisbenGroup', event.target.value)} required>
                      <option value="">Selecciona tu grupo</option>
                      {SISBEN.map(item => <option key={item}>{item}</option>)}
                    </select>
                    <small className="affiliation-help">Lo encuentras en sisben.gov.co. A: pobreza extrema · B: pobreza moderada · C: vulnerable.</small>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <p className="affiliation-form__intro">Inscribe a tu grupo familiar. Son beneficiarios sin costo adicional: cónyuge o compañero(a) permanente, hijos menores de 25 años y, si no tienes cónyuge ni hijos, tus padres.</p>
                  {!data.beneficiaries.length && <p className="portal-empty">No has agregado beneficiarios. Este paso es opcional.</p>}
                  {data.beneficiaries.map((person, index) => (
                    <div className="beneficiary" key={person.key}>
                      <div className="beneficiary__head">
                        <strong>Beneficiario {index + 1}{person.birthDate ? ` · ${ageFrom(person.birthDate)} años` : ''}</strong>
                        <button type="button" className="schedule-editor__remove" onClick={() => setData(c => ({ ...c, beneficiaries: c.beneficiaries.filter((_, i) => i !== index) }))} aria-label="Quitar beneficiario">×</button>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Parentesco *</label>
                          <select value={person.relationship} onChange={event => setBeneficiary(index, 'relationship', event.target.value)} required>
                            <option value="">Selecciona</option>
                            {RELATIONSHIPS.map(item => <option key={item}>{item}</option>)}
                          </select>
                        </div>
                        <div className="form-group"><label>Nombres y apellidos *</label><input value={person.name} onChange={event => setBeneficiary(index, 'name', event.target.value)} required minLength="5" /></div>
                      </div>
                      <div className="form-row form-row--3">
                        <div className="form-group">
                          <label>Tipo de documento *</label>
                          <select value={person.documentType} onChange={event => setBeneficiary(index, 'documentType', event.target.value)}>
                            {DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                        <div className="form-group"><label>Número *</label><DocumentInput documentType={person.documentType} value={person.document} onChange={event => setBeneficiary(index, 'document', event.target.value)} required /></div>
                        <div className="form-group"><label>Fecha de nacimiento *</label><input type="date" max={todayBogota()} value={person.birthDate} onChange={event => setBeneficiary(index, 'birthDate', event.target.value)} required /></div>
                      </div>
                    </div>
                  ))}
                  {data.beneficiaries.length < 6 && (
                    <button type="button" className="schedule-editor__add" onClick={() => setData(c => ({ ...c, beneficiaries: [...c.beneficiaries, { key: Math.random(), relationship: '', name: '', documentType: 'RC', document: '', birthDate: '' }] }))}>+ Agregar beneficiario</button>
                  )}
                </>
              )}

              {step === 5 && (
                <>
                  <div className="affiliation-summary">
                    <div><span>Afiliado</span><strong>{[data.firstName, data.secondName, data.firstSurname, data.secondSurname].filter(Boolean).join(' ')}</strong></div>
                    <div><span>Documento</span><strong>{data.documentType} {data.document}</strong></div>
                    <div><span>Régimen</span><strong>{isContributive ? `Contributivo · ${data.affiliateType}` : `Subsidiado · SISBÉN ${data.sisbenGroup}`}</strong></div>
                    <div><span>Residencia</span><strong>{data.city}, {data.department}</strong></div>
                    <div><span>IPS primaria</span><strong>{data.primaryIps}</strong></div>
                    <div><span>Beneficiarios</span><strong>{data.beneficiaries.length}</strong></div>
                  </div>
                  <p className="affiliation-form__intro">Crea la contraseña con la que ingresarás al portal usando tu número de documento.</p>
                  <div className="form-row">
                    <div className="form-group"><label htmlFor="password">Contraseña *</label><PasswordInput id="password" value={data.password} onChange={event => set('password', event.target.value)} minLength={8} required autoComplete="new-password" /><PasswordHints value={data.password} /></div>
                    <div className="form-group"><label htmlFor="password2">Confirmar contraseña *</label><PasswordInput id="password2" value={data.passwordConfirm} onChange={event => set('passwordConfirm', event.target.value)} required autoComplete="new-password" /></div>
                  </div>
                  <div className="declarations">
                    <label><input type="checkbox" checked={data.declareNoOtherEps} onChange={event => set('declareNoOtherEps', event.target.checked)} required /> Declaro que ni yo ni mis beneficiarios estamos afiliados como cotizantes o beneficiarios en otra EPS (la multiafiliación está prohibida).</label>
                    <label><input type="checkbox" checked={data.acceptTruthfulness} onChange={event => set('acceptTruthfulness', event.target.checked)} required /> Declaro que la información suministrada es verdadera y autorizo su verificación ante la BDUA y demás entidades.</label>
                    <label><input type="checkbox" checked={data.acceptDataPolicy} onChange={event => set('acceptDataPolicy', event.target.checked)} required /> Autorizo el tratamiento de mis datos personales y de salud conforme a la Ley 1581 de 2012 y la política de privacidad de Detritus Salud E.P.S.</label>
                  </div>
                </>
              )}

              {state.message && <p className={`form-status form-status--${state.status}`} role="alert">{state.message}</p>}
              <div className="affiliation-form__actions">
                {step > 0 ? <button type="button" className="btn btn--ghost" onClick={() => goTo(step - 1)}>← Anterior</button> : <span />}
                <button type="submit" className="btn btn--primary" disabled={state.status === 'loading'}>
                  {step < STEPS.length - 1 ? 'Continuar →' : state.status === 'loading' ? 'Radicando…' : 'Radicar afiliación'}
                </button>
              </div>
            </form>
          </div>

          <aside className="appointment-aside">
            <div className="appointment-note">
              <span className="appointment-note__label">Ten a la mano</span>
              <h3>Lo que necesitas</h3>
              <ul>
                <li>Tu documento de identidad y el de tus beneficiarios.</li>
                <li>Datos de tu empleador (NIT) si eres dependiente, o tu ingreso mensual si eres independiente.</li>
                <li>Tu grupo del SISBÉN IV si solicitas el régimen subsidiado.</li>
                <li>Un correo y un celular activos para recibir notificaciones.</li>
              </ul>
            </div>
            <Alert type="info">¿Ya estás afiliado? Usa el botón <strong>Ingresar</strong> con tu documento y contraseña.</Alert>
          </aside>
        </div>
      </section>
    </>
  );
}
