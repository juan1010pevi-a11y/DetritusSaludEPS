import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import { Link } from 'react-router-dom';
import { AUTH_STATUS, AuthorizationDocument, PrintableModal } from '../../components/Documents/EpsDocuments';
import { useAuth } from '../../context/AuthContext';
import { getAuthorizations } from '../../services/api';
import './Autorizaciones.css';
import { DocumentInput } from '../../components/FormFields/FormFields';

export default function Autorizaciones() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [document, setDocument] = useState(null);
  const { user, role } = useAuth();

  const handleSubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await getAuthorizations(String(form.get('document')).trim(), String(form.get('number')).trim());
      setItems(data.items || []);
      setStatus(data.items?.length ? '' : 'No encontramos una autorización con ese número para este documento.');
    } catch (error) {
      setItems([]);
      setStatus(error.message || 'No fue posible consultar el sistema de autorizaciones.');
    }
  };

  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Consulta de autorizaciones"
        icon="▣"
        description="Consulta el estado de tus autorizaciones."
        image="/img/autorizaciones.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Consulta de autorizaciones' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <form className="info-card authorization-form" onSubmit={handleSubmit}>
            <h3>Consultar autorización</h3>
            <p className="authorization-form__intro">Verifica el estado de una solicitud médica con los datos de tu autorización.</p>
            <div className="form-group"><label htmlFor="authorization-number">Número de autorización</label><input id="authorization-number" name="number" type="text" placeholder="AUT-2026-123456 o SOL-2026-123456" required /></div>
            <div className="form-row"><div className="form-group"><label htmlFor="document-type">Tipo de documento</label><select id="document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Cédula de extranjería</option><option>Tarjeta de identidad</option><option>Pasaporte</option></select></div><div className="form-group"><label htmlFor="patient-document">Documento del paciente</label><DocumentInput id="patient-document" name="document" required /></div></div>
            <button className="btn btn--primary" type="submit">Consultar estado</button>
            {status && <p className="form-status" role="status">{status}</p>}
            {items.map(item => (
              <article className="authorization-result" key={item.id}>
                <div><strong>{item.serviceName}</strong><span>{item.authNumber || item.id} · {item.patientName}</span></div>
                <span className={`status-pill status-pill--${item.status}`}>{AUTH_STATUS[item.status]}</span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDocument(item)}>{item.status === 'approved' ? 'Ver y descargar' : 'Ver detalle'}</button>
              </article>
            ))}
            <p className="authorization-form__portal">
              {user && role === 'affiliate'
                ? <>Para solicitar una nueva autorización entra a <Link to="/portal?tab=autorizaciones">Mi portal → Autorizaciones</Link>.</>
                : 'Para solicitar una autorización nueva, ingresa como afiliado con el botón Ingresar.'}
            </p>
          </form>
          {document && (
            <PrintableModal title="Autorización" onClose={() => setDocument(null)} canPrint={document.status === 'approved'}>
              <AuthorizationDocument item={document} />
            </PrintableModal>
          )}
          <Alert type="gold">Tiempos de respuesta: urgencias 30 min · solicitudes no urgentes hasta 5 días hábiles · medicamentos NO PBS hasta 10 días.</Alert>
        </div>
      </section>
    </>
  );
}
