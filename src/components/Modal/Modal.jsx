import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

export default function Modal({ title, onClose, children, wide = false, className = '' }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  return createPortal(
    <div className={`modal-backdrop ${className}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="modal__close no-print" onClick={onClose} aria-label="Cerrar">×</button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
