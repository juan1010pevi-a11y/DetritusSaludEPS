import LineIcon from '../LineIcon/LineIcon';
import './ChatFab.css';
export default function ChatFab() {
  return (
    <a href="https://wa.me/573172761239" target="_blank" rel="noopener noreferrer" className="chat-fab" aria-label="WhatsApp - Registro y Control Académico U. Católica">
      <span className="chat-fab__icon"><LineIcon name="chat" /></span>
      <span className="chat-fab__badge">!</span>
      <span className="chat-fab__tooltip">Registro y Control Académico U. Católica</span>
    </a>
  );
}
