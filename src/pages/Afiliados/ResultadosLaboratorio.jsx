import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../../components/PageHero/PageHero';
import Alert from '../../components/Alert/Alert';
import LabReportModal from '../../components/LabReport/LabReport';
import { useAuth } from '../../context/AuthContext';
import { getLabResults, getMyLabResults } from '../../services/api';
import { formatDate, formatDateTime, LAB_STATUS } from '../../lib/roles';
import './ResultadosLaboratorio.css';
import { DocumentInput } from '../../components/FormFields/FormFields';

function statusDetail(result) {
  if (result.status === 'available') return `Validado el ${formatDateTime(result.validatedAt || result.resultDate)}`;
  if (result.status === 'processing') return `Muestra tomada el ${formatDateTime(result.sampleTakenAt)}`;
  if (result.status === 'scheduled') return `Toma de muestra: ${formatDate(result.appointmentDate)} ${result.appointmentTime || ''}`;
  return 'Orden cancelada';
}

function ResultCard({ result, onOpen }) {
  return (
    <article className="lab-result">
      <div><span className="lab-result__label">Examen</span><strong>{result.testName}</strong></div>
      <div><span className="lab-result__label">Orden</span><span>{result.orderNumber}</span></div>
      <div><span className="lab-result__label">Estado</span><span>{statusDetail(result)}</span></div>
      <div><span className="lab-result__label">Resultado</span><span>{result.status === 'available' ? result.result : 'Aún no disponible'}</span></div>
      <span className={`lab-result__status lab-result__status--${result.status}`}>{LAB_STATUS[result.status] || result.status}</span>
      <button type="button" className="btn btn--primary btn--sm lab-result__open" onClick={() => onOpen(result)}>
        {result.status === 'available' ? 'Ver documento de resultados' : 'Ver detalle'}
      </button>
    </article>
  );
}

export default function ResultadosLaboratorio() {
  const { user, role, openLogin } = useAuth();
  const [status, setStatus] = useState('');
  const [results, setResults] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (role !== 'affiliate') { setMine([]); return; }
    getMyLabResults().then(data => setMine(data.items || [])).catch(() => setMine([]));
  }, [role, user]);

  const handleSubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setStatus('Consultando resultados...');
    try {
      const data = await getLabResults(String(form.get('document')).trim(), String(form.get('orderNumber')).trim());
      setResults(data.items || []);
      setStatus(data.items?.length ? '' : 'No encontramos una orden con ese documento y número. Verifica los datos.');
    } catch (error) {
      setResults([]);
      setStatus(error.message || 'No fue posible consultar el servicio de laboratorio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHero label="Afiliados" title="Resultados de laboratorio" description="Consulta y descarga tus resultados de laboratorio de forma segura." image="/img/medicamentos.jpg" breadcrumb={[{ label: 'Afiliados', path: '/afiliados' }, { label: 'Resultados de laboratorio' }]} />
      <section className="content-section">
        <div className="container lab-results-layout">
          <div className="lab-results-main">
            {role === 'affiliate' && (
              <div className="info-card lab-results-form">
                <h2>Mis resultados</h2>
                <p className="lab-results-form__intro">Órdenes de laboratorio de {user.name}.</p>
                {!mine.length && <p className="form-status">No tienes órdenes de laboratorio. <Link to="/tramites/agendar-cita">Agenda tu toma de muestra</Link>.</p>}
                {mine.map(result => <ResultCard key={result.id} result={result} onOpen={setReport} />)}
              </div>
            )}

            <form className="info-card lab-results-form" onSubmit={handleSubmit}>
              <h2>Consulta por número de orden</h2>
              <p className="lab-results-form__intro">Ingresa el documento del paciente y el número de orden que recibiste al agendar el examen.</p>
              <div className="form-row"><div className="form-group"><label htmlFor="lab-document-type">Tipo de documento</label><select id="lab-document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option><option>Pasaporte</option></select></div><div className="form-group"><label htmlFor="lab-document">Número de documento</label><DocumentInput id="lab-document" name="document" defaultValue={role === 'affiliate' ? user.document : ''} required /></div></div>
              <div className="form-group"><label htmlFor="lab-order">Número de orden</label><input id="lab-order" name="orderNumber" type="text" placeholder="LAB-2026-123456" required /></div>
              <button className="btn btn--primary" type="submit" disabled={loading}>{loading ? 'Consultando...' : 'Consultar resultados'}</button>
              {status && <p className="form-status" role="status">{status}</p>}
              {results.map(result => <ResultCard key={result.id} result={result} onOpen={setReport} />)}
            </form>
          </div>
          <aside className="lab-results-aside">
            <div className="lab-results-note">
              <span className="lab-results-note__label">Información importante</span>
              <h3>¿Cómo funciona?</h3>
              <ul>
                <li><strong>Muestra pendiente:</strong> la cita de toma de muestra está agendada.</li>
                <li><strong>En análisis:</strong> el laboratorio registró la toma de muestra y está procesándola (24 a 72 horas).</li>
                <li><strong>Resultado disponible:</strong> el bacteriólogo validó el documento; puedes verlo, imprimirlo o guardarlo en PDF.</li>
              </ul>
            </div>
            {!user && (
              <Alert type="info">
                ¿Eres afiliado? <button type="button" className="lab-results-login" onClick={() => openLogin({ role: 'affiliate', redirect: '/afiliados/resultados-laboratorio' })}>Ingresa</button> para ver todas tus órdenes sin escribir el número.
              </Alert>
            )}
            <Alert type="info">Si no encuentras tu resultado, comunícate con la IPS donde te realizaron el examen.</Alert>
          </aside>
        </div>
      </section>
      {report && <LabReportModal document={report} onClose={() => setReport(null)} />}
    </>
  );
}
