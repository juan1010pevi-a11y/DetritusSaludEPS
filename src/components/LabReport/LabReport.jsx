import Modal from '../Modal/Modal';
import { formatDate, formatDateTime, LAB_STATUS } from '../../lib/roles';
import './LabReport.css';

const FLAG_LABEL = { H: 'Alto', L: 'Bajo' };

/** Documento oficial de resultados de laboratorio, listo para imprimir o guardar en PDF. */
export function LabReportDocument({ document }) {
  return (
    <article className="lab-report">
      <header className="lab-report__header">
        <div className="lab-report__brand">
          <img src="/logo.png" alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />
          <div>
            <strong>Detritus Salud E.P.S.</strong>
            <span>Laboratorio clínico · NIT 900.123.456-7</span>
          </div>
        </div>
        <div className="lab-report__order">
          <span>Orden</span>
          <strong>{document.orderNumber}</strong>
          <span className={`status-pill status-pill--${document.status}`}>{LAB_STATUS[document.status] || document.status}</span>
        </div>
      </header>

      <h3 className="lab-report__title">Informe de resultados · {document.testName}</h3>

      <dl className="lab-report__meta">
        <div><dt>Paciente</dt><dd>{document.patientName}</dd></div>
        <div><dt>Documento</dt><dd>{document.patientDocument}</dd></div>
        <div><dt>Tipo de muestra</dt><dd>{document.sampleType || '—'}</dd></div>
        <div><dt>Sede</dt><dd>{document.site || '—'}</dd></div>
        <div><dt>Toma de muestra</dt><dd>{formatDateTime(document.sampleTakenAt)}</dd></div>
        <div><dt>Fecha de validación</dt><dd>{document.validatedAt ? formatDateTime(document.validatedAt) : 'Pendiente'}</dd></div>
      </dl>

      {document.items?.length ? (
        <table className="lab-report__table">
          <thead>
            <tr><th>Parámetro</th><th>Resultado</th><th>Unidad</th><th>Valor de referencia</th></tr>
          </thead>
          <tbody>
            {document.items.map(item => (
              <tr key={item.id} className={item.flag ? 'is-flagged' : ''}>
                <td>{item.parameter}</td>
                <td>
                  <strong>{item.value || '—'}</strong>
                  {item.flag && <span className={`lab-report__flag lab-report__flag--${item.flag}`}>{FLAG_LABEL[item.flag]}</span>}
                </td>
                <td>{item.unit}</td>
                <td>{item.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="lab-report__pending">
          {document.status === 'scheduled' && `Tu cita de toma de muestra es el ${formatDate(document.appointmentDate)} a las ${document.appointmentTime}. Los resultados aparecerán aquí cuando el laboratorio los valide.`}
          {document.status === 'processing' && 'La muestra fue tomada y está en análisis. Los resultados estarán disponibles entre 24 y 72 horas.'}
          {document.status === 'cancelled' && 'Esta orden fue cancelada. Si necesitas el examen, agenda una nueva cita de laboratorio.'}
        </p>
      )}

      {document.status === 'available' && (
        <>
          {document.result && <p className="lab-report__summary"><strong>Interpretación:</strong> {document.result}</p>}
          {document.observations && <p className="lab-report__summary"><strong>Observaciones:</strong> {document.observations}</p>}
          <footer className="lab-report__footer">
            <div className="lab-report__signature">
              <span className="lab-report__sign-line" />
              <strong>{document.validatedBy}</strong>
              <span>Profesional que valida</span>
            </div>
            <p>Documento generado electrónicamente por Detritus Salud E.P.S. Los resultados deben ser interpretados por su médico tratante.</p>
          </footer>
        </>
      )}
    </article>
  );
}

export default function LabReportModal({ document, onClose }) {
  return (
    <Modal title={`Resultados ${document.orderNumber}`} onClose={onClose} wide className="printable-modal lab-report-modal">
      <LabReportDocument document={document} />
      <div className="lab-report__actions no-print">
        {document.status === 'available' && (
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}
