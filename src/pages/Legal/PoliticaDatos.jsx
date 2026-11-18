import PageHero from '../../components/PageHero/PageHero';
import '../../styles/tramite-pages.css';

// Versión vigente de la política. Debe coincidir con DATA_POLICY_VERSION en backend/src/users-service.js.
export const DATA_POLICY_VERSION = '2026-11';

const SECTIONS = [
  {
    title: 'Responsable del tratamiento',
    items: [
      'Detritus Salud E.P.S. (proyecto académico) es responsable de los datos personales que recibe por este portal.',
      'Canal de atención para consultas y reclamos sobre datos: Radicar PQRSD, tipo “Petición”, asunto “Datos personales”.',
    ],
  },
  {
    title: 'Datos que tratamos',
    items: [
      'Identificación y contacto: tipo y número de documento, nombres, fecha de nacimiento, dirección, correo y celular.',
      'Afiliación: régimen, tipo de cotizante, empleador, ingreso base, grupo SISBÉN y beneficiarios.',
      'Datos sensibles de salud (Ley 1581, art. 5): historia clínica, diagnósticos, fórmulas y resultados de laboratorio.',
    ],
  },
  {
    title: 'Finalidades',
    items: [
      'Gestionar la afiliación, la prestación de servicios de salud, citas, autorizaciones, fórmulas y PQRSD.',
      'Enviar avisos sobre tus trámites por correo, SMS y, si lo autorizas, WhatsApp.',
      'Cumplir obligaciones legales del Sistema General de Seguridad Social en Salud.',
    ],
  },
  {
    title: 'Tus derechos como titular',
    items: [
      'Conocer, actualizar y rectificar tus datos (opción “Actualiza datos” del portal).',
      'Solicitar prueba de la autorización otorgada y ser informado sobre el uso de tus datos.',
      'Revocar la autorización o pedir la supresión cuando no exista un deber legal de conservarlos (la historia clínica se conserva según la Resolución 1995 de 1999).',
      'Presentar quejas ante la Superintendencia de Industria y Comercio.',
    ],
  },
  {
    title: 'Cómo protegemos tus datos',
    items: [
      'Los datos de salud y los datos personales de alto riesgo se guardan cifrados (AES-256-GCM).',
      'Solo tú, el profesional que te atiende y el personal autorizado pueden ver tu historia clínica; cada consulta queda registrada.',
      'Las contraseñas se guardan con hash (scrypt) y el acceso del personal médico y administrativo puede exigir verificación en dos pasos.',
      'La comunicación viaja cifrada (HTTPS) y tu sesión se guarda en una cookie protegida que no puede leer ningún script.',
    ],
  },
  {
    title: 'Datos sensibles y de menores',
    items: [
      'No estás obligado a autorizar el tratamiento de datos sensibles; sin embargo, sin ellos no es posible prestar el servicio de salud.',
      'Los datos de menores de edad se tratan respetando su interés superior y con autorización de su representante legal.',
    ],
  },
];

export default function PoliticaDatos() {
  return (
    <>
      <PageHero
        label="Protección de datos"
        title="Política de Tratamiento de Datos Personales"
        icon="🔒"
        description="Ley 1581 de 2012 y Decreto 1377 de 2013."
        image="/img/nosotros.jpg"
        breadcrumb={[{ label: 'Política de datos' }]}
      />
      <section className="tramite-content">
        <div className="container">
          <div className="tramite-content__header">
            <span className="section-label">Versión {DATA_POLICY_VERSION}</span>
            <h2 className="section-heading">Así tratamos y protegemos tu información</h2>
            <p className="tramite-content__intro">
              Al marcar la casilla de autorización en el registro, la afiliación o la radicación de PQRSD aceptas esta política.
              Guardamos la fecha y la versión que aceptaste como prueba de tu autorización.
            </p>
          </div>
          <div className="tramite-grid">
            {SECTIONS.map(section => (
              <article key={section.title} className="tramite-card">
                <h3>{section.title}</h3>
                <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
