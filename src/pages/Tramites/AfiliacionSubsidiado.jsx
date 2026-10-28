import { Link } from 'react-router-dom';
import PageHero from '../../components/PageHero/PageHero';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './AfiliacionSubsidiado.css';

export default function AfiliacionSubsidiado() {
  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Afiliación régimen subsidiado"
        icon="🤝"
        description="Afiliación gratuita para personas clasificadas en el SISBEN."
        image="/img/afiliacion-subsidiado.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Afiliación régimen subsidiado' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <Alert type="info">La afiliación al régimen subsidiado es gratuita para las personas clasificadas por el SISBEN según la normativa vigente.</Alert>
          <div className="subsidized-process">
            <div className="subsidized-process__main">
              <span className="section-label">Ruta de afiliación</span>
              <h2 className="section-heading">Afíliate en cinco pasos</h2>
              <p className="subsidized-process__intro">Sigue este proceso para solicitar tu afiliación y recibir orientación de un asesor.</p>
              <StepList steps={[{title:"Verifica tu SISBEN",text:"Consulta tu clasificación en sisben.gov.co o en la alcaldía."},{title:"Reúne tus documentos",text:"Prepara tu documento de identidad, certificado SISBEN y registros civiles de tus beneficiarios."},{title:"Visita un punto de atención",text:"Lleva los documentos originales y una copia de cada uno."},{title:"Diligencia el formulario",text:"Un asesor revisará tu información y te acompañará durante el proceso."},{title:"Recibe tu carné digital",text:"Te enviaremos la confirmación y las instrucciones a tu correo."}]} />
            </div>
            <aside className="subsidized-process__aside">
              <div className="subsidized-checklist">
                <span className="subsidized-checklist__eyebrow">Antes de comenzar</span>
                <h3>Ten a la mano</h3>
                <ul>
                  <li>Documento de identidad vigente</li>
                  <li>Certificado o clasificación SISBEN</li>
                  <li>Datos de contacto actualizados</li>
                </ul>
                <Link to="/afiliados/puntos-atencion" className="btn btn--primary btn--sm">Ver puntos de atención</Link>
              </div>
              <p className="subsidized-process__note">El trámite no tiene costo y no requiere intermediarios.</p>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
