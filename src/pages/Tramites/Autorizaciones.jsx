import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import { getAuthorizations } from '../../services/api';
import './Autorizaciones.css';

export default function Autorizaciones() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);

  const handleSubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await getAuthorizations(form.get('document'));
      setItems(data.items || []);
      setStatus(data.items?.length ? 'Autorizaciones encontradas.' : 'No encontramos autorizaciones para este documento.');
    } catch {
      setItems([]);
      setStatus('No fue posible consultar el sistema de autorizaciones.');
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
            <div className="form-group"><label htmlFor="authorization-number">Número de autorización</label><input id="authorization-number" type="text" placeholder="AUTH-2026-123456" required /></div>
            <div className="form-row"><div className="form-group"><label htmlFor="document-type">Tipo de documento</label><select id="document-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Cédula de ciudadanía</option><option>Cédula de extranjería</option><option>Tarjeta de identidad</option><option>Pasaporte</option></select></div><div className="form-group"><label htmlFor="patient-document">Documento del paciente</label><input id="patient-document" name="document" type="text" placeholder="1020304050" required /></div></div>
            <div className="form-group"><label htmlFor="service-type">Tipo de servicio</label><select id="service-type" defaultValue="" required><option value="" disabled>Selecciona una opción</option><option>Consulta especializada</option><option>Procedimiento médico</option><option>Examen diagnóstico</option><option>Medicamento</option><option>Hospitalización</option></select></div>
            <div className="form-group"><label htmlFor="authorization-email">Correo para notificaciones <span>(opcional)</span></label><input id="authorization-email" type="email" placeholder="correo@ejemplo.com" /></div>
            <button className="btn btn--primary" type="submit">Consultar estado</button>
            {status && <p className="form-status" role="status">{status}</p>}
            {items.map(item => <p className="form-status" key={item.id}>Autorización {item.id}: {item.status}</p>)}
          </form><Alert type="gold">Tiempos de respuesta: urgencias 30 min · solicitudes no urgentes hasta 5 días hábiles · medicamentos NO PBS hasta 10 días.</Alert>
        </div>
      </section>
    </>
  );
}
