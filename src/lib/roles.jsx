// Identidad visual de cada perfil: se usa en la barra superior, el portal y el login.
export const ROLES = {
  affiliate: {
    key: 'affiliate',
    label: 'Afiliado',
    portalTitle: 'Portal del afiliado',
    description: 'Agenda citas, consulta resultados y gestiona tus trámites.',
    icon: 'user',
  },
  doctor: {
    key: 'doctor',
    label: 'Médico',
    portalTitle: 'Portal médico',
    description: 'Consulta tu agenda, registra atenciones y gestiona tu horario.',
    icon: 'stethoscope',
  },
  administrator: {
    key: 'administrator',
    label: 'Administrador',
    portalTitle: 'Consola administrativa',
    description: 'Gestiona médicos, horarios, perfiles de acceso y la agenda general.',
    icon: 'shield',
  },
};

export const ROLE_ORDER = ['affiliate', 'doctor', 'administrator'];

export function roleLabel(role) {
  return ROLES[role]?.label || role;
}

export function RoleIcon({ role, className = 'role-icon' }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    stethoscope: <><path d="M6 3v6a5 5 0 0 0 10 0V3" /><path d="M11 14v2a5 5 0 0 0 10 0v-2" /><circle cx="21" cy="12" r="2" /><path d="M4 3h4M14 3h4" /></>,
    shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[ROLES[role]?.icon || 'user']}
    </svg>
  );
}

export function initials(name = '') {
  return name
    .replace(/^(Dr|Dra|Ps|Bact)\.\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');
}

// ---------- Formatos de fecha y estados ----------
export function formatDate(value, options = { dateStyle: 'medium' }) {
  if (!value) return 'Fecha pendiente';
  const date = new Date(`${value}${value.length === 10 ? 'T12:00:00' : ''}`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', options).format(date);
}

export function formatLongDate(value) {
  return formatDate(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(date);
}

export function formatTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'p. m.' : 'a. m.';
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export const APPOINTMENT_STATUS = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  completed: 'Atendida',
  no_show: 'No asistió',
  cancelled: 'Cancelada',
  reschedule_required: 'Por reprogramar',
};

export const LAB_STATUS = {
  scheduled: 'Muestra pendiente',
  processing: 'En análisis',
  available: 'Resultado disponible',
  cancelled: 'Orden cancelada',
};

/** Fecha de hoy en Colombia (YYYY-MM-DD). */
export function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
