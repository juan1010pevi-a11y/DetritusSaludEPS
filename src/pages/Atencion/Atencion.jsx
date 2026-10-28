import LineIcon from '../../components/LineIcon/LineIcon';
import './Atencion.css';

const channels = [
  { icon: 'phone', title: 'Línea telefónica', main: '018000 123 456', sub: 'Gratuita nacional', hours: 'Lun–Vie 7am–8pm · Urgencias 24/7', color: '#EEF2F8' },
  { icon: 'chat', title: 'WhatsApp', main: '+57 317 276 1239', sub: 'Registro y Control Académico U. Católica', hours: 'Lun–Sáb 7am–7pm · <30 min respuesta', color: '#f0fdf4', link: 'https://wa.me/573172761239' },
  { icon: 'mail', title: 'Correo electrónico', main: 'servicioalcliente@detritus.com.co', sub: 'Para trámites formales', hours: 'Respuesta en 1–2 días hábiles', color: '#fefce8' },
  { icon: 'building', title: 'Atención presencial', main: '12+ puntos de atención', sub: 'Sin cita previa', hours: 'Lun–Vie 7am–5pm · Sáb 8am–12pm', color: '#fdf2f8' },
];

export default function Atencion() {
  return (
    <>
      <section className="atencion-hero">
        <div className="container atencion-hero__inner">
          <div className="atencion-hero__text">
            <span className="section-label" style={{color:'var(--gold-light)'}}>Estamos para ayudarte</span>
            <h1>Atención al<br /><em>usuario</em></h1>
            <p>Múltiples canales disponibles para resolver tus dudas, realizar trámites o reportar una emergencia.</p>
            <div className="atencion-hero__emergency">
              <span className="atencion-hero__emergency-icon"><LineIcon name="alert" /></span>
              <div>
                <strong>¿Emergencia médica?</strong>
                <span>Llama al 018000 123 456 opción 1 — disponible 24/7</span>
              </div>
            </div>
          </div>
          <div className="atencion-hero__img">
            <img src="/img/atencion-usuario.jpg" alt="Atención al usuario" onError={e=>e.target.parentElement.style.display='none'} />
          </div>
        </div>
      </section>

      <section className="atencion-channels">
        <div className="container">
          <span className="section-label">Canales de contacto</span>
          <h2 className="section-heading">Escoge el canal que prefieras</h2>
          <div className="channel-grid">
            {channels.map((c, i) => (
              <div key={i} className="channel-card" style={{'--bg': c.color}}>
                <div className="channel-card__icon"><LineIcon name={c.icon} /></div>
                <h3>{c.title}</h3>
                <p className="channel-card__main">{c.main}</p>
                <p className="channel-card__sub">{c.sub}</p>
                <span className="channel-card__hours">{c.hours}</span>
                {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm" style={{marginTop:'1rem'}}>Abrir WhatsApp</a>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="atencion-hours">
        <div className="container">
          <div className="hours-banner">
            <div className="hours-col"><span className="hours-icon"><LineIcon name="clock" /></span><h3>Horario general</h3><p>Lunes a viernes 7:00am – 7:00pm<br/>Sábados 8:00am – 2:00pm</p></div>
            <div className="hours-divider" />
            <div className="hours-col"><span className="hours-icon"><LineIcon name="ambulance" /></span><h3>Urgencias</h3><p>24 horas al día<br/>7 días a la semana<br/>365 días al año</p></div>
            <div className="hours-divider" />
            <div className="hours-col"><span className="hours-icon"><LineIcon name="chat" /></span><h3>WhatsApp</h3><p>Lunes a sábado<br/>7:00am – 7:00pm<br/>Respuesta en &lt;30 min</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
