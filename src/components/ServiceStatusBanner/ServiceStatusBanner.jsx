import { useEffect, useState } from 'react';
import { getPublicHealth } from '../../services/api';

// Nombre que ve el ciudadano para cada microservicio.
const PUBLIC_NAMES = {
  auth: 'inicio de sesión',
  users: 'registro y afiliaciones',
  content: 'noticias',
  notifications: 'envío de notificaciones',
  healthcare: 'citas, autorizaciones e historia clínica',
  pqrs: 'PQRSD',
  'meds-labs': 'medicamentos y resultados de laboratorio',
};

/**
 * Aviso en la parte superior cuando algún microservicio está apagado: dice qué no está
 * disponible y aclara que el resto del sitio funciona normalmente (degradación controlada).
 */
export default function ServiceStatusBanner() {
  const [down, setDown] = useState([]);

  useEffect(() => {
    let active = true;
    const check = () => getPublicHealth().then(health => {
      if (active) setDown(Array.isArray(health?.down) ? health.down : []);
    });
    check();
    const timer = setInterval(check, 20000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  if (!down.length) return null;
  const names = down.map(name => PUBLIC_NAMES[name] || name).join(', ');
  return (
    <div className="service-banner" role="status">
      <div className="container">
        <strong>Servicio parcialmente disponible.</strong> En este momento no funciona: {names}. El resto del sitio funciona con normalidad.
      </div>
    </div>
  );
}
