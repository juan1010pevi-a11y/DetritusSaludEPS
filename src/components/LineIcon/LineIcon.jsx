import './LineIcon.css';

const iconPaths = {
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>,
  lab: <><path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.8 3h6.4a2 2 0 0 0 1.8-3l-5-9V3" /><path d="M7.5 15h9" /></>,
  pill: <><path d="M7 17 17 7a3.5 3.5 0 0 0-5-5L2 12a3.5 3.5 0 0 0 5 5Z" /><path d="m5 9 5 5" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M13 10h5M13 14h4" /></>,
  document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4M9 13h6M9 17h4" /></>,
  phone: <><path d="M7 4h3l1.5 4-2 1.5a14 14 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2C10.8 19.5 4.5 13.2 4 6a2 2 0 0 1 2-2h1Z" /></>,
  chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3-.5L4 20l1.5-4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  building: <><path d="M4 21V5l8-3 8 3v16M2 21h20M8 8h1M15 8h1M8 12h1M15 12h1M8 16h1M15 16h1" /></>,
  alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  ambulance: <><path d="M3 16V6h11v10M14 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M7 9h4M9 7v4" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3v-3a3 3 0 0 1 3-3h1" /></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" /><path d="M8 20V7a3 3 0 0 1 3-3M9 9h7M9 13h7" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  chart: <><path d="M4 20V4M4 20h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
  diamond: <><path d="m12 3 8 6-8 12L4 9l8-6Z" /><path d="m4 9 16 0M9 9l3 12 3-12" /></>,
  handshake: <><path d="m3 11 4-4 4 3 3-2 7 5-4 5-6-3-4 3-4-3Z" /><path d="m7 7 3-3 4 2 3-2 4 4" /></>,
  star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></>,
  rocket: <><path d="M14 4c3-1 5-1 6-1 0 1 0 3-1 6l-5 5-4-4 4-6Z" /><path d="m10 10-4 1-3 3 5 1M14 14l-1 4-3 3-1-5M6 18l-2 2" /></>,
  bank: <><path d="M3 10h18L12 3 3 10Z" /><path d="M5 10v7M9 10v7M15 10v7M19 10v7M3 21h18M2 17h20" /></>,
  edit: <><path d="m4 16-.8 4.8L8 20l11-11a2.8 2.8 0 0 0-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  certificate: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v5h4M8 12h8M8 16h5" /><path d="m15 18 2 3 2-3" /></>,
  refresh: <><path d="M4 12a8 8 0 0 1 13.5-5.8L20 9" /><path d="M20 4v5h-5M20 12a8 8 0 0 1-13.5 5.8L4 15" /><path d="M4 20v-5h5" /></>,
  note: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h4M9 13h6M9 17h4" /></>,
  heart: <><path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z" /></>,
  tooth: <><path d="M7 3c2.2 0 3.1 1.3 5 1.3S14.8 3 17 3c2.7 0 4 2.2 3.4 5.1-.5 2.4-1.6 3.4-1.8 6.2-.2 2.3-.8 6.7-2.8 6.7-1.7 0-1.8-5.1-3.8-5.1s-2.1 5.1-3.8 5.1c-2 0-2.6-4.4-2.8-6.7-.2-2.8-1.3-3.8-1.8-6.2C3 5.2 4.3 3 7 3Z" /></>,
  baby: <><circle cx="12" cy="7" r="3" /><path d="M5 21c.8-4.3 3.1-6.5 7-6.5s6.2 2.2 7 6.5M12 14v4M10 16h4" /></>,
  hospital: <><path d="M4 21V5h16v16M2 21h20M9 8h6M12 5v6M8 14h1M15 14h1M8 18h1M15 18h1" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .8-1.7 1.3-1.7 2.7M12 17h.01" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M8 10h8M8 14h6M8 18h4" /></>,
  vaccine: <><path d="m14 4 6 6M12 6l6 6M17 3l4 4M6 21l4-4M4 17l3 3M9 15l-4-4 6-6 4 4-6 6Z" /></>,
  brain: <><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4H9ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4h1Z" /><path d="M7 9h2M6 13h3M15 9h2M15 13h3" /></>,
  lightbulb: <><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-.8.7-1 1.5-1 2H9c0-.5-.2-1.3-1-2Z" /></>,
  leaf: <><path d="M20 4C10 4 4 9 4 16c0 2.2 1.8 4 4 4 7 0 12-6 12-16Z" /><path d="M4 20c3-5 7-8 12-10" /></>,
  people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 19c.6-3 2.5-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 15c2.8-.6 5.1.9 6 4" /></>,
};

const legacyNames = {
  '📞': 'phone', '💬': 'chat', '📧': 'mail', '🏢': 'building', '🚨': 'alert', '🕐': 'clock', '🚑': 'ambulance',
  '🗺️': 'route', '💊': 'pill', '📋': 'clipboard', '🏥': 'hospital', '🛏️': 'hospital', '🔬': 'lab', '❤️': 'heart',
  '🤰': 'baby', '🦷': 'tooth', '🧠': 'brain', '💡': 'lightbulb', '🌿': 'leaf', '📄': 'document', '📑': 'document',
  '📍': 'building', '💳': 'card', '🏠': 'home', '🔍': 'search', '❓': 'question', '💉': 'vaccine', '📱': 'card',
  '📖': 'book', '🎯': 'target', '📊': 'chart', '💎': 'diamond', '🤝': 'handshake', '⭐': 'star', '🚀': 'rocket', '🏛️': 'bank', '✏️': 'edit', '📜': 'certificate', '🔄': 'refresh', '📝': 'note',
};

export default function LineIcon({ name, className = '' }) {
  const iconName = legacyNames[name] || name;
  return <svg className={`line-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[iconName] || iconPaths.document}</svg>;
}
