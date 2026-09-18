import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './MedicinaDomiciliaria.css';

export default function MedicinaDomiciliaria() {
  return (
    <>
      <PageHero
        label="Afiliados"
        title="Medicina domiciliaria"
        icon="🏠"
        description="Atención médica en tu hogar."
        image="/img/medicina-domiciliaria.jpg"
        breadcrumb={[
          { label: 'Afiliados', path: '/afiliados' },
          { label: 'Medicina domiciliaria' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <Alert type="gold">Disponible para pacientes con movilidad reducida o tratamiento crónico.</Alert><StepList steps={[{title:"Solicita la valoración",text:"Tu médico debe emitir la orden de atención domiciliaria."},{title:"Programa la visita",text:"Llama al 018000 123 456 o ingresa al portal."},{title:"Recibe la atención",text:"Un profesional visitará tu domicilio en el horario acordado."}]} />
        </div>
      </section>
    </>
  );
}
