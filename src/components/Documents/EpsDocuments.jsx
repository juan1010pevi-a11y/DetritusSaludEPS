import Modal from '../Modal/Modal';
import { formatDate, formatDateTime, formatLongDate, todayBogota } from '../../lib/roles';
import '../LabReport/LabReport.css';
import './EpsDocuments.css';

export const AUTH_STATUS = { requested: 'En auditoría', approved: 'Aprobada', denied: 'Negada' };
export const PRESCRIPTION_STATUS = { pending: 'En alistamiento', available: 'Lista para reclamar', delivered: 'Entregada' };

function Header({ subtitle, label, number, status, statusLabel }) {
  return (
    <header className="lab-report__header">
      <div className="lab-report__brand">
        <img src="/logo.png" alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />
        <div>
          <strong>Detritus Salud E.P.S.</strong>
          <span>{subtitle} · NIT 900.123.456-7</span>
        </div>
      </div>
      <div className="lab-report__order">
        <span>{label}</span>
        <strong>{number}</strong>
        {statusLabel && <span className={`status-pill status-pill--${status}`}>{statusLabel}</span>}
      </div>
    </header>
  );
}

/** Código de verificación determinístico para que el documento parezca uno real y se pueda validar. */
function verificationCode(text) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36).toUpperCase().padStart(7, '0').slice(0, 8);
}

export function AuthorizationDocument({ item }) {
  const approved = item.status === 'approved';
  return (
    <article className="lab-report">
      <Header subtitle="Autorización de servicios de salud" label={approved ? 'Autorización' : 'Solicitud'}
        number={approved ? item.authNumber : item.id} status={item.status} statusLabel={AUTH_STATUS[item.status]} />
      <h3 className="lab-report__title">{item.serviceName}</h3>
      <dl className="lab-report__meta">
        <div><dt>Paciente</dt><dd>{item.patientName}</dd></div>
        <div><dt>Documento</dt><dd>{item.patientDocument}</dd></div>
        <div><dt>Plan</dt><dd>{item.plan || 'Régimen contributivo'}</dd></div>
        <div><dt>Médico que ordena</dt><dd>{item.orderedBy}</dd></div>
        <div><dt>Orden médica</dt><dd>{item.orderReference}</dd></div>
        <div><dt>Fecha de solicitud</dt><dd>{formatDateTime(item.createdAt)}</dd></div>
        {approved && <div><dt>Prestador autorizado</dt><dd>{item.provider}</dd></div>}
        {approved && <div><dt>Vigencia hasta</dt><dd>{formatDate(item.validUntil)}</dd></div>}
        {item.decidedAt && <div><dt>Fecha de respuesta</dt><dd>{formatDateTime(item.decidedAt)}</dd></div>}
      </dl>
      <p className="lab-report__summary"><strong>Motivo / diagnóstico:</strong> {item.reason}</p>
      {item.status === 'requested' && (
        <p className="lab-report__pending">Tu solicitud está en auditoría médica. Tiempo de respuesta: hasta 5 días hábiles ({item.priority === 'prioritaria' ? 'prioritaria: 48 horas' : 'normal'}).</p>
      )}
      {item.status === 'denied' && <p className="doc-alert doc-alert--denied"><strong>Motivo de la negación:</strong> {item.decisionNotes}</p>}
      {approved && (
        <>
          {item.decisionNotes && <p className="lab-report__summary"><strong>Observaciones:</strong> {item.decisionNotes}</p>}
          <p className="doc-alert">Presenta este documento y tu cédula en el prestador autorizado antes de la fecha de vigencia. La autorización es personal e intransferible.</p>
          <footer className="lab-report__footer">
            <div className="lab-report__signature">
              <span className="lab-report__sign-line" />
              <strong>{item.decidedBy}</strong>
              <span>Auditoría médica</span>
            </div>
            <p>Código de verificación: <strong>{verificationCode(`${item.authNumber}${item.patientDocument}`)}</strong></p>
          </footer>
        </>
      )}
    </article>
  );
}

export function FormulaDocument({ formula }) {
  const first = formula.items[0];
  return (
    <article className="lab-report">
      <Header subtitle="Fórmula médica" label="Fórmula" number={formula.formulaNumber}
        status={formula.status} statusLabel={PRESCRIPTION_STATUS[formula.status]} />
      <dl className="lab-report__meta">
        <div><dt>Paciente</dt><dd>{first.patientName}</dd></div>
        <div><dt>Documento</dt><dd>{first.patientDocument}</dd></div>
        <div><dt>Fecha de emisión</dt><dd>{formatDate(first.issuedAt)}</dd></div>
        <div><dt>Médico tratante</dt><dd>{first.doctorName || '—'}</dd></div>
        <div><dt>Vigente hasta</dt><dd>{first.validUntil ? formatDate(first.validUntil) : '—'}</dd></div>
        <div><dt>Punto de entrega</dt><dd>{first.deliveryPoint || 'Por asignar'}</dd></div>
      </dl>
      <table className="lab-report__table">
        <thead><tr><th>Medicamento</th><th>Dosis y frecuencia</th><th>Cantidad</th></tr></thead>
        <tbody>
          {formula.items.map(item => (
            <tr key={item.id}><td>{item.medication}</td><td>{item.dosage}</td><td>{item.quantity}</td></tr>
          ))}
        </tbody>
      </table>
      {first.instructions && <p className="lab-report__summary"><strong>Indicaciones:</strong> {first.instructions}</p>}
      {formula.status === 'pending' && <p className="lab-report__pending">La farmacia está alistando tus medicamentos. Te avisaremos cuando estén listos para reclamar.</p>}
      {formula.status === 'available' && <p className="doc-alert">Listos para reclamar en <strong>{first.deliveryPoint}</strong>. Presenta tu cédula y esta fórmula.</p>}
      {formula.status === 'delivered' && <p className="doc-alert">Medicamentos entregados el {formatDateTime(first.dispensedAt || first.updatedAt)}.</p>}
      <footer className="lab-report__footer">
        <div className="lab-report__signature">
          <span className="lab-report__sign-line" />
          <strong>{first.doctorName || 'Médico tratante'}</strong>
          <span>Firma del profesional</span>
        </div>
        <p>Medicamentos del Plan de Beneficios en Salud (PBS) sin costo para el afiliado.</p>
      </footer>
    </article>
  );
}

export function CertificateDocument({ profile }) {
  const today = todayBogota();
  const code = verificationCode(`${profile.document}${today}`);
  const active = profile.status === 'active';
  const typeLabel = { dependiente: 'cotizante dependiente', independiente: 'cotizante independiente', pensionado: 'cotizante pensionado', cabeza_familia: 'cabeza de familia' }[profile.affiliateType] || 'cotizante';
  const since = String(profile.effectiveDate || profile.createdAt || today).slice(0, 10);
  const docLabel = { CC: 'cédula de ciudadanía', CE: 'cédula de extranjería', PA: 'pasaporte', PPT: 'Permiso por Protección Temporal' }[profile.documentType] || 'cédula de ciudadanía';
  return (
    <article className="lab-report certificate">
      <Header subtitle="Certificado de afiliación" label="Expedido" number={formatDate(today)} />
      <h3 className="lab-report__title certificate__title">CERTIFICA QUE</h3>
      <p className="certificate__body">
        <strong>{profile.name.toUpperCase()}</strong>, identificado(a) con {docLabel} número{' '}
        <strong>{profile.document}</strong>, se encuentra <strong>{active ? 'AFILIADO(A) Y ACTIVO(A)' : 'AFILIADO(A) CON ESTADO INACTIVO'}</strong>{' '}
        en Detritus Salud E.P.S. en el <strong>{profile.plan}</strong>, en calidad de {typeLabel}, con servicios desde el {formatLongDate(since)}.
      </p>
      <dl className="lab-report__meta">
        <div><dt>Estado</dt><dd>{active ? 'Activo' : 'Inactivo'}</dd></div>
        <div><dt>Régimen</dt><dd>{profile.plan}</dd></div>
        <div><dt>Tipo de afiliado</dt><dd style={{ textTransform: 'capitalize' }}>{typeLabel}</dd></div>
        {profile.primaryIps && <div><dt>IPS primaria</dt><dd>{profile.primaryIps}</dd></div>}
        {profile.filingNumber && <div><dt>Radicado de afiliación</dt><dd>{profile.filingNumber}</dd></div>}
      </dl>
      {profile.beneficiaries?.length > 0 && (
        <>
          <p className="certificate__body">Y que tiene inscrito el siguiente grupo familiar como beneficiario:</p>
          <table className="lab-report__table">
            <thead><tr><th>Nombre</th><th>Documento</th><th>Parentesco</th></tr></thead>
            <tbody>{profile.beneficiaries.map(person => <tr key={person.document}><td>{person.name}</td><td>{person.documentType} {person.document}</td><td>{person.relationship}</td></tr>)}</tbody>
          </table>
        </>
      )}
      <p className="certificate__body">Se expide a solicitud del interesado en Bogotá D.C., el {formatLongDate(today)}. Este certificado tiene una vigencia de 30 días.</p>
      <footer className="lab-report__footer">
        <div className="lab-report__signature">
          <span className="lab-report__sign-line" />
          <strong>Dirección de Aseguramiento</strong>
          <span>Detritus Salud E.P.S.</span>
        </div>
        <p>Documento generado electrónicamente. Código de verificación: <strong>{code}</strong>. Valídalo en la línea 018000 123 456.</p>
      </footer>
    </article>
  );
}

export function PrintableModal({ title, onClose, children, canPrint = true }) {
  return (
    <Modal title={title} onClose={onClose} wide className="printable-modal">
      {children}
      <div className="lab-report__actions no-print">
        {canPrint && <button type="button" className="btn btn--primary" onClick={() => window.print()}>Imprimir / Guardar PDF</button>}
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

/** Agrupa los ítems de fórmula por número de fórmula. */
export function groupFormulas(items) {
  const map = new Map();
  items.forEach(item => {
    if (!map.has(item.formulaNumber)) map.set(item.formulaNumber, { formulaNumber: item.formulaNumber, status: item.status, items: [] });
    map.get(item.formulaNumber).items.push(item);
  });
  return [...map.values()];
}
