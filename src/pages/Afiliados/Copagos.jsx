import LineIcon from '../../components/LineIcon/LineIcon';
import './Copagos.css';
import Alert from '../../components/Alert/Alert';

export default function Copagos() {
  return (
    <>
      <section className="copagos-hero">
        <div className="container">
          <nav className="breadcrumb"><a href="/">Inicio</a><span className="sep">›</span><a href="/afiliados">Afiliados</a><span className="sep">›</span><span>Copagos</span></nav>
          <div className="copagos-hero__split">
            <div>
              <span className="section-label" style={{color:'var(--gold-light)'}}>Información financiera</span>
              <h1>Copagos y cuotas<br />moderadoras</h1>
              <p>Conoce los valores que aplican según tu régimen e ingreso base de cotización.</p>
            </div>
            <div className="copagos-hero__img-wrap">
              <img src="/img/copagos.jpg" alt="Copagos" onError={e=>e.target.parentElement.style.display='none'} />
            </div>
          </div>
        </div>
      </section>

      <section className="copagos-regimes">
        <div className="container">
          <div className="regime-compare">
            <div className="regime-card regime-card--contrib">
              <div className="regime-card__badge">Contributivo</div>
              <h3>Régimen contributivo</h3>
              <p>Aplican <strong>cuotas moderadoras</strong> para regular el uso de los servicios. El valor depende de tu ingreso base de cotización (IBC).</p>
              <ul>
                <li>Consultas médicas generales y especializadas</li>
                <li>Servicios de urgencias</li>
                <li>Hospitalización</li>
                <li>Procedimientos diagnósticos</li>
              </ul>
            </div>
            <div className="regime-card regime-card--sub">
              <div className="regime-card__badge regime-card__badge--gold">Subsidiado</div>
              <h3>Régimen subsidiado</h3>
              <p><strong>No se cobran</strong> copagos ni cuotas moderadoras. Todos los servicios del Plan de Beneficios son completamente gratuitos.</p>
              <div className="regime-card__free">
                <span className="regime-card__free-icon">✓</span>
                <span>100% gratuito para población SISBEN</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="copagos-table">
        <div className="container">
          <span className="section-label">Tarifas vigentes 2026</span>
          <h2 className="section-heading">Tabla de cuotas moderadoras</h2>
          <Alert type="info">Valores según resolución del Ministerio de Salud. IBC: Ingreso Base de Cotización. SMMLV: Salario Mínimo Mensual.</Alert>
          <div className="table-card">
            <table>
              <thead><tr><th>Servicio</th><th>Hasta 2 SMMLV</th><th>2 – 5 SMMLV</th><th>Mayor a 5 SMMLV</th></tr></thead>
              <tbody>
                <tr><td><strong>🩺 Consulta general</strong></td><td>$3.900</td><td>$9.500</td><td>$18.500</td></tr>
                <tr><td><strong>👨‍⚕️ Consulta especializada</strong></td><td>$6.400</td><td>$15.900</td><td>$31.200</td></tr>
                <tr><td><strong><LineIcon name="ambulance" /> Urgencias</strong></td><td>$18.500</td><td>$37.000</td><td>$55.500</td></tr>
                <tr><td><strong><LineIcon name="hospital" /> Hospitalización / día</strong></td><td>$30.900</td><td>$61.800</td><td>$92.700</td></tr>
                <tr><td><strong><LineIcon name="pill" /> Medicamentos</strong></td><td colSpan="3" style={{textAlign:'center',color:'var(--gold)',fontWeight:600}}>Sin costo con fórmula médica PBS</td></tr>
                <tr><td><strong><LineIcon name="lab" /> Laboratorio clínico</strong></td><td>$3.900</td><td>$9.500</td><td>$18.500</td></tr>
              </tbody>
            </table>
          </div>
          <div className="copagos-note">
            <div className="copagos-note__item"><strong>⚠️ Exentos de copago:</strong> Menores de 1 año · Programas de control prenatal · Enfermedades de alto costo · Atención inicial de urgencias</div>
          </div>
        </div>
      </section>
    </>
  );
}
