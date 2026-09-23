import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import './Trabaja.css';

export default function Trabaja() {
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setFileName('');
      event.target.value = '';
      setStatus('Selecciona un archivo PDF, DOC o DOCX.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileName('');
      event.target.value = '';
      setStatus('La hoja de vida no puede superar los 5 MB.');
      return;
    }
    setFileName(file.name);
    setStatus('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus('Tu información está lista para ser enviada al equipo de selección.');
  };

  return (
    <>
      <PageHero
        label="Nosotros"
        title="Trabaja con nosotros"
        icon="🤝"
        description="Únete al equipo de profesionales."
        image="/img/trabaja.jpg"
        breadcrumb={[
          { label: 'Nosotros', path: '/nosotros' },
          { label: 'Trabaja con nosotros' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <Alert type="info">Ofrecemos beneficios de salud, desarrollo profesional y ambiente inclusivo.</Alert>
          <form className="info-card job-form" onSubmit={handleSubmit}>
            <h3>Envía tu hoja de vida</h3>
            <p className="job-form__intro">Déjanos tus datos y cuéntanos cómo puedes aportar a nuestro equipo.</p>
            <div className="form-row"><div className="form-group"><label htmlFor="full-name">Nombre completo</label><input id="full-name" type="text" placeholder="Tu nombre" required /></div><div className="form-group"><label htmlFor="email">Email</label><input id="email" type="email" placeholder="correo@ejemplo.com" required /></div></div>
            <div className="form-row"><div className="form-group"><label htmlFor="phone">Teléfono</label><input id="phone" type="tel" placeholder="3001234567" required /></div><div className="form-group"><label htmlFor="city">Ciudad</label><input id="city" type="text" placeholder="Bogotá" required /></div></div>
            <div className="form-row"><div className="form-group"><label htmlFor="position">Cargo de interés</label><select id="position" required defaultValue=""><option value="" disabled>Selecciona un cargo</option><option>Médico general</option><option>Enfermera</option><option>Auxiliar administrativo</option><option>Otro</option></select></div><div className="form-group"><label htmlFor="availability">Disponibilidad</label><select id="availability" required defaultValue=""><option value="" disabled>Selecciona una opción</option><option>Tiempo completo</option><option>Medio tiempo</option><option>Por turnos</option></select></div></div>
            <div className="form-group"><label htmlFor="experience">Experiencia profesional</label><textarea id="experience" placeholder="Cuéntanos brevemente sobre tu experiencia y habilidades..." required /></div>
            <div className="form-group"><label htmlFor="resume">Hoja de vida</label><input id="resume" type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} required /><span className="file-help">Formatos permitidos: PDF, DOC o DOCX. Tamaño máximo: 5 MB.</span>{fileName && <span className="file-name">Archivo seleccionado: {fileName}</span>}</div>
            <label className="consent"><input type="checkbox" required /> <span>Autorizo el tratamiento de mis datos personales para procesos de selección.</span></label>
            <button className="btn btn--primary" type="submit">Enviar postulación</button>
            {status && <p className="form-status" role="status">{status}</p>}
          </form>
        </div>
      </section>
    </>
  );
}
