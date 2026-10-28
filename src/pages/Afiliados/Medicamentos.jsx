import { useState } from 'react';
import LineIcon from '../../components/LineIcon/LineIcon';
import Alert from '../../components/Alert/Alert';
import { Link } from 'react-router-dom';
import { FormulaDocument, groupFormulas, PRESCRIPTION_STATUS, PrintableModal } from '../../components/Documents/EpsDocuments';
import { useAuth } from '../../context/AuthContext';
import { getPrescriptions } from '../../services/api';
import './Medicamentos.css';
import { DocumentInput } from '../../components/FormFields/FormFields';

export default function Medicamentos() {
  const [status, setStatus] = useState('');
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formula, setFormula] = useState(null);
  const { user, role } = useAuth();

  const handleSubmit = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setStatus('Consultando fórmula...');
    try {
      const data = await getPrescriptions(form.get('document'), form.get('prescriptionNumber'));
      setPrescriptions(data.items || []);
      setStatus(data.items?.length ? '' : 'No encontramos una fórmula con esos datos.');
    } catch (error) {
      setPrescriptions([]);
      setStatus(error.message || 'No fue posible consultar el servicio farmacéutico.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="med-hero">
        <div className="container">
          <nav className="breadcrumb"><a href="/">Inicio</a><span className="sep">›</span><a href="/afiliados">Afiliados</a><span className="sep">›</span><span>Medicamentos</span></nav>
          <span className="section-label" style={{color:'var(--gold-light)'}}>Farmacia</span>
          <h1>Medicamentos</h1>
          <p>Accede a todos los medicamentos del Plan de Beneficios en Salud sin costo con tu fórmula médica vigente.</p>
        </div>
      </section>

      <section className="med-features">
        <div className="container">
          <div className="med-split">
            <div className="med-split__img"><img src="/img/medicamentos.jpg" alt="Medicamentos" onError={e=>e.target.parentElement.style.display='none'} /></div>
            <div className="med-split__content">
              <h2 className="section-heading">¿Cómo acceder a tus medicamentos?</h2>
              <div className="med-feature">
                <div className="med-feature__num">1</div>
                <div><h4>Recibe tu fórmula médica</h4><p>Al terminar tu consulta, el médico emite la fórmula y te llega a tu portal.</p></div>
              </div>
              <div className="med-feature">
                <div className="med-feature__num">2</div>
                <div><h4>Dirígete al punto de dispensación</h4><p>Cuando la farmacia la aliste, verás el punto donde reclamarla.</p></div>
              </div>
              <div className="med-feature">
                <div className="med-feature__num">3</div>
                <div><h4>Recibe tus medicamentos</h4><p>Los medicamentos PBS son entregados sin ningún costo.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="med-lookup">
        <div className="container med-lookup__layout">
          <div className="med-lookup__copy"><span className="section-label">Consulta en línea</span><h2 className="section-heading">Revisa tu fórmula y punto de entrega</h2><p>Consulta la disponibilidad de tus medicamentos con tu documento y número de fórmula.</p></div>
          <form className="med-lookup__form" onSubmit={handleSubmit}>
            <div className="form-row"><div className="form-group"><label htmlFor="medicine-document">Documento</label><DocumentInput id="medicine-document" name="document" required /></div><div className="form-group"><label htmlFor="prescription-number">Número de fórmula</label><input id="prescription-number" name="prescriptionNumber" type="text" placeholder="FAR-2026-123456" required /></div></div>
            <button className="btn btn--primary" type="submit" disabled={loading}>{loading ? 'Consultando...' : 'Consultar disponibilidad'}</button>
            {status && <p className="form-status" role="status">{status}</p>}
            {prescriptions.map(prescription => (
              <article className="med-result" key={prescription.id}>
                <div><span className="med-result__label">Medicamento</span><strong>{prescription.medication}</strong></div>
                <div><span className="med-result__label">Dosis y cantidad</span><span>{prescription.dosage} · {prescription.quantity} unidades</span></div>
                <div><span className="med-result__label">Entrega</span><span>{prescription.deliveryPoint || 'Punto por confirmar'}</span></div>
                <span className={`med-result__status med-result__status--${prescription.status}`}>{PRESCRIPTION_STATUS[prescription.status] || prescription.status}</span>
              </article>
            ))}
            {prescriptions.length > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFormula(groupFormulas(prescriptions)[0])}>Ver fórmula completa</button>
            )}
            <p className="med-lookup__portal">
              {user && role === 'affiliate'
                ? <>Ve todas tus fórmulas en <Link to="/portal?tab=medicamentos">Mi portal → Medicamentos</Link>.</>
                : 'Si eres afiliado, ingresa con el botón Ingresar para ver todas tus fórmulas sin escribir el número.'}
            </p>
          </form>
        </div>
      </section>

      {formula && (
        <PrintableModal title="Fórmula médica" onClose={() => setFormula(null)}>
          <FormulaDocument formula={formula} />
        </PrintableModal>
      )}

      <section className="med-services">
        <div className="container">
          <div className="med-cards">
            <div className="med-card"><span className="med-card__icon"><LineIcon name="clipboard" /></span><h3>Medicamentos PBS</h3><p>Todos los del listado aprobado por MinSalud. Gratuitos con fórmula.</p></div>
            <div className="med-card"><span className="med-card__icon"><LineIcon name="building" /></span><h3>200+ puntos de entrega</h3><p>Disponibles en farmacias aliadas en todo el país.</p></div>
            <div className="med-card med-card--highlight"><span className="med-card__icon"><LineIcon name="home" /></span><h3>Entrega a domicilio</h3><p>Sin costo para tratamientos crónicos. Solicítalo al 018000 123 456.</p><span className="med-card__tag">Popular</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
