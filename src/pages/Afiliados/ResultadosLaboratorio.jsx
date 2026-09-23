import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import Alert from '../../components/Alert/Alert';
import { getLabResults } from '../../services/api';
import './ResultadosLaboratorio.css';

export default function ResultadosLaboratorio() {
  const [status, setStatus] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setStatus('Consultando resultados...');
    try {
      const data = await getLabResults(form.get('document'), form.get('orderNumber'));
      setResults(data.items || []);
      setStatus(data.items?.length ? 'Resultado encontrado.' : 'No encontramos resultados con esos datos.');
    } catch {
      setResults([]);
      setStatus('No fue posible consultar el servicio de laboratorio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHero label="Afiliados" title="Resultados de laboratorio" description="Consulta tus resultados de laboratorio de forma segura." image="/img/medicamentos.jpg" breadcrumb={[{ label: 'Afiliados', path: '/afiliados' }, { label: 'Resultados de laboratorio' }]} />
      <section className="content-section">
        <div className="container lab-results-layout">
          <form className="info-card lab-results-form" onSubmit={handleSubmit}>
            <h2>Consulta tus resultados</h2>
            <p className="lab-results-form__intro">Ingresa los datos de la orden o examen entregados por tu IPS.</p>
            <div className="form-row"><div className="form-group"><label htmlFor="lab-document-type">Tipo de documento</label><select id="lab-document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option><option>Pasaporte</option></select></div><div className="form-group"><label htmlFor="lab-document">Número de documento</label><input id="lab-document" name="document" type="text" placeholder="1020304050" required /></div></div>
            <div className="form-group"><label htmlFor="lab-order">Número de orden o examen</label><input id="lab-order" name="orderNumber" type="text" placeholder="LAB-2026-123456" required /></div>
            <div className="form-group"><label htmlFor="lab-email">Correo electrónico <span>(opcional)</span></label><input id="lab-email" type="email" placeholder="correo@ejemplo.com" /></div>
            <button className="btn btn--primary" type="submit" disabled={loading}>{loading ? 'Consultando...' : 'Consultar resultados'}</button>
            {status && <p className="form-status" role="status">{status}</p>}
            {results.map(result => (
              <article className="lab-result" key={result.id}>
                <div><span className="lab-result__label">Examen</span><strong>{result.testName}</strong></div>
                <div><span className="lab-result__label">Fecha</span><span>{result.resultDate || 'Pendiente'}</span></div>
                <div><span className="lab-result__label">Resultado</span><span>{result.result || 'Aún no disponible'}</span></div>
                <span className={`lab-result__status lab-result__status--${result.status}`}>{result.status === 'available' ? 'Disponible' : 'Pendiente'}</span>
              </article>
            ))}
          </form>
          <aside className="lab-results-aside"><div className="lab-results-note"><span className="lab-results-note__label">Información importante</span><h3>Resultados seguros</h3><p>Algunos exámenes pueden tardar entre 24 y 72 horas en estar disponibles después de la toma de muestra.</p><ul><li>Usa el documento del paciente.</li><li>Verifica el número de orden.</li><li>Descarga tus resultados desde el portal de tu IPS.</li></ul></div><Alert type="info">Si no encuentras tu resultado, comunícate con la IPS donde te realizaron el examen.</Alert></aside>
        </div>
      </section>
    </>
  );
}
