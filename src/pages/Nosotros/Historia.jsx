import { Link } from 'react-router-dom';
import './Historia.css';

export default function Historia() {
  const timeline = [
    { year: '2019', title: 'El avistamiento', emoji: '',
      text: 'Una noche de noviembre, tres estudiantes de Ingenieria de Sistemas de la Universidad Catolica de Colombia regresaban de un parcial de bases de datos por la carretera que conecta Bogota con Sopo, Cundinamarca. A las 11:47 PM, el motor del Chevrolet Spark de Juan Felipe se apago. El cielo sobre la Sabana se ilumino con un resplandor verde esmeralda. Lo ultimo que recuerdan es un zumbido grave que les vibro los dientes.' },
    { year: '2019', title: 'Los tres dias perdidos', emoji: '',
      text: 'Santiago, Jose y Juan Felipe despertaron tres dias despues en un potrero de Cajica, con los zapatos puestos al reves y un conocimiento inexplicable de anatomia humana, bioquimica y protocolos quirurgicos. Santiago podia recitar de memoria los 7.000 medicamentos del listado PBS. Jose diagnosticaba enfermedades con solo mirar a alguien. Juan Felipe sentia una urgencia incontrolable de... organizar historias clinicas en bases de datos normalizadas.' },
    { year: '2020', title: 'La transformacion', emoji: '',
      text: 'Los tres abandonaron la ingenieria de sistemas (con un promedio de 3.2) y entraron a medicina. Terminaron la carrera en 2 anios. Nadie cuestiono esto. Los profesores reportaban que sus ojos brillaban levemente en la oscuridad durante los turnos de noche, pero lo atribuyeron al cansancio. La entidad alienigena dentro de ellos -- conocida en su mundo como "Detritus" -- necesitaba acceso masivo a especimenes humanos. Que mejor vehiculo que una EPS?' },
    { year: '2022', title: 'Nace Detritus Salud E.P.S.', emoji: '',
      text: 'Con capital de origen "no determinado" (la Supersalud aun investiga), los tres fundaron Detritus Salud E.P.S. en un local de Zipaquira que antes era una tienda de arepas. El nombre fue idea de la entidad: "Detritus" significa "materia organica descompuesta" -- lo que los alienigenas consideran la forma mas pura de la vida. Los humanos asumieron que era latin elegante. Nadie busco en Google.' },
    { year: '2023', title: 'Expansion sospechosamente rapida', emoji: '',
      text: 'En solo un anio, Detritus Salud paso de 0 a 400.000 afiliados. Los consultorios tenian una tasa de satisfaccion del 99.7%. Los pacientes reportaban sentirse "extraniamente ligeros" despues de cada cita, como si les hubieran sacado algo. La Supersalud envio auditores. Los auditores salieron diciendo que todo estaba en orden. Sus ojos brillaban levemente.' },
    { year: '2024', title: 'El millon', emoji: '',
      text: 'Un millon de colombianos afiliados. La red de IPS crecio a 600 sedes. Juan Felipe desarrollo un sistema de historia clinica electronica que, segun el, "se le ocurrio en un suenio". El codigo fuente contenia comentarios en un idioma que ningun linguista reconocio. El ICBF investigo reportes de ninios que despues de los controles pediatricos podian resolver ecuaciones diferenciales, pero cerro el caso por falta de evidencia de danio.' },
    { year: '2025', title: 'Telemedicina intergalactica', emoji: '',
      text: 'Detritus lanzo su plataforma de telemedicina. Los servidores estaban ubicados en Funza, Cundinamarca, pero las pruebas de latencia mostraban tiempos de respuesta de 0.003ms -- fisicamente imposible. La explicacion oficial fue "infraestructura de punta". Un ingeniero de redes que investigo demasiado fue transferido al departamento de "Bienestar Corporativo Extendido". No se le volvio a ver en reuniones presenciales, pero sus reportes seguian llegando puntuales.' },
    { year: '2026', title: 'Hoy -- La mision continua', emoji: '',
      text: '1.2 millones de afiliados. 800 IPS. 32 departamentos. Los tres fundadores siguen al frente: Santiago como Director Medico, Jose como Director de Operaciones y Juan Felipe como CTO. Cada jueves a las 3:33 AM, los tres se reunen en el sotano de la sede principal en Bogota para una "reunion de planeacion estrategica". Las camaras de seguridad se apagan solas durante esas reuniones. El vigilante reporta un leve temblor en el piso y un olor a ozono. Detritus Salud sigue creciendo. La mision continua. Tu proxima cita esta agendada.' },
  ];

  return (
    <>
      <section className="historia-hero">
        <div className="historia-hero__bg" />
        <div className="container historia-hero__inner">
          <div className="historia-hero__text">
            <span className="section-label" style={{color: '#7DF9FF'}}>Archivo clasificado -- Nivel 7</span>
            <h1>Nuestra <em>historia</em></h1>
            <p>Como tres estudiantes de la Universidad Catolica de Colombia se convirtieron en los fundadores de la EPS mas eficiente de Cundinamarca. Version oficial. No verificar.</p>
          </div>
          <div className="historia-hero__visual">
            <img src="/img/historia.jpg" alt="Historia de Detritus Salud" onError={e => e.target.parentElement.style.display='none'} />
          </div>
        </div>
      </section>

      <section className="founders">
        <div className="container">
          <span className="section-label">Los fundadores</span>
          <h2 className="section-heading">Tres mentes. Una mision.</h2>
          <div className="founders__grid">
            <div className="founder-card">
              <div className="founder-card__avatar">S.E.</div>
              <h3>Dr. Santiago Esguerra</h3>
              <span className="founder-card__role">Director Medico</span>
              <p>Ex estudiante de Ing. de Sistemas. Promedio: 3.1. Ahora diagnostica enfermedades con solo mirar al paciente. Ojos: cafe oscuro. A veces verdes. A veces brillan.</p>
            </div>
            <div className="founder-card">
              <div className="founder-card__avatar">J.R.</div>
              <h3>Dr. Jose Rico</h3>
              <span className="founder-card__role">Director de Operaciones</span>
              <p>Ex estudiante de Ing. de Sistemas. Promedio: 3.4. Logro afiliar un millon de personas en 2 anios. La Supersalud lo considera "estadisticamente improbable".</p>
            </div>
            <div className="founder-card">
              <div className="founder-card__avatar">J.F.P.</div>
              <h3>Ing. Juan Felipe Perez</h3>
              <span className="founder-card__role">CTO</span>
              <p>El unico que no abandono la ingenieria. Su codigo tiene comentarios en un idioma no catalogado. Sus servidores violan las leyes de la fisica. Nadie pregunta.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="timeline-section">
        <div className="container">
          <span className="section-label">Linea temporal</span>
          <h2 className="section-heading">Cronologia de los hechos</h2>
          <div className="timeline">
            {timeline.map((item, i) => (
              <div key={i} className={`timeline__item ${i % 2 === 0 ? 'timeline__item--left' : 'timeline__item--right'}`}>
                <div className="timeline__dot">{item.year}</div>
                <div className="timeline__card">
                  <span className="timeline__year">{item.year}</span>
                  <h3 className="timeline__title">{item.title}</h3>
                  <p className="timeline__text">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="disclaimer">
        <div className="container">
          <div className="disclaimer__box">
            <span className="disclaimer__icon">[ CLASIFICADO ]</span>
            <p><strong>Nota de la Oficina de Comunicaciones:</strong> Esta es la version oficial de la historia institucional de Detritus Salud E.P.S. Cualquier similitud con eventos extraterrestres reales es puramente coincidencial. Si despues de leer esto siente un leve hormigueo detras de las orejas, es completamente normal. Probablemente.</p>
            <Link to="/nosotros" className="btn btn--ghost" style={{marginTop:'1rem'}}>Volver a Nosotros</Link>
          </div>
        </div>
      </section>
    </>
  );
}