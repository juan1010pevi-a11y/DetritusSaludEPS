import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './Requisitos.css';

export default function Requisitos() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Requisitos de afiliación"
        icon="📄"
        description="Documentos necesarios para afiliarte."
        image="/img/requisitos.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Requisitos de afiliación' }
        ]}
      />
      <section className="affiliate-content">
        <div className="container">
          <div className="affiliate-content__header"><div><span className="section-label">Antes de comenzar</span><h2 className="section-heading">Prepara tus documentos</h2><p className="affiliate-content__intro">Elige el régimen que corresponde a tu situación y reúne los documentos para recibir orientación sin demoras.</p></div></div>
          <div className="affiliate-content__grid"><div className="affiliate-content__card"><h3>Régimen contributivo</h3><p>Para trabajadores dependientes o independientes.</p><ul><li>Cédula de ciudadanía</li><li>Contrato laboral o RUT</li><li>Formulario de afiliación</li><li>Registro civil de beneficiarios</li></ul></div><div className="affiliate-content__card"><h3>Régimen subsidiado</h3><p>Para personas clasificadas por el SISBEN.</p><ul><li>Cédula de ciudadanía</li><li>Certificado o clasificación SISBEN</li><li>Registro civil de beneficiarios</li><li>Formulario de afiliación</li></ul></div></div><Alert type="gold">Lleva documentos originales y copia a cualquier punto de atención. El proceso es gratuito.</Alert>
        </div>
      </section>
    </>
  );
}
