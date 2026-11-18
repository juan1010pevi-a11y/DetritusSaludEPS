import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import { getAffiliationStatus } from '../../services/api';
import './ConsultaAfiliados.css';
import { DocumentInput } from '../../components/FormFields/FormFields';

export default function ConsultaAfiliados() {
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  // Consulta pública: el backend solo responde estado y régimen (sin nombre ni datos de contacto).
  const handleSubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await getAffiliationStatus(String(form.get('document') || '').trim());
      if (!data.found) {
        setResult(null);
        setStatus('No encontramos un afiliado con ese documento.');
        return;
      }
      setResult(data);
      setStatus(`Afiliación ${data.status === 'active' ? 'activa' : 'inactiva'}.`);
    } catch (error) {
      setResult(null);
      setStatus(error.status === 429 || error.status === 400 ? error.message : 'No fue posible consultar en este momento.');
    }
  };
  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Consulta de afiliados"
        icon="🔍"
        description="Verifica el estado de afiliación."
        image="/img/consulta-afiliados.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Consulta de afiliados' }
        ]}
      />
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header"><span className="section-label">Consulta en línea</span><h2 className="section-heading">Verifica tu afiliación</h2><p className="tramite-content__intro">Confirma si tu afiliación está activa y el régimen al que perteneces.</p></div>
          <form className="info-card tramite-form" onSubmit={handleSubmit}><h2>Consultar afiliación</h2><p className="tramite-form__intro">Ingresa los datos del afiliado.</p><div className="form-group"><label htmlFor="affiliate-document-type">Tipo de documento</label><select id="affiliate-document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Tarjeta de identidad</option><option>Cédula de extranjería</option></select></div><div className="form-group"><label htmlFor="affiliate-document">Número de documento</label><DocumentInput id="affiliate-document" name="document" required /></div><button className="btn btn--primary" type="submit">Consultar estado</button>{status && <p className="form-status" role="status">{status}</p>}{result && <div className="form-status">{result.eps} · Régimen {result.regime}</div>}<p className="tramite-note">Por protección de datos (Ley 1581 de 2012) esta consulta pública no muestra nombres ni datos de contacto. Para ver tu información completa ingresa al portal.</p></form>
        </div>
      </section>
    </>
  );
}
