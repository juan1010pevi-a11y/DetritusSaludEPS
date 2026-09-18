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
      <section className="content-section">
        <div className="container">
          <div className="info-grid"><InfoCard icon="💼" title="Contributivo" text="Cédula · Contrato laboral o RUT · Formulario · Registro civil de beneficiarios." /><InfoCard icon="🤝" title="Subsidiado" text="Cédula · Certificado SISBEN · Registro civil · Formulario de afiliación." /></div><Alert type="gold">Lleva documentos originales y copia a cualquier punto de atención. Proceso gratuito.</Alert>
        </div>
      </section>
    </>
  );
}
