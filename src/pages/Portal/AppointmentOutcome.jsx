import { AUTH_STATUS } from '../../components/Documents/EpsDocuments';

function parseOrders(value) {
  if (!value) return [];
  return value.split('|').map(entry => {
    const [id, service, status] = entry.split('~');
    return { id, service, status };
  });
}

/** Lo que salió de una cita atendida: diagnóstico, fórmula y órdenes de autorización. */
export default function AppointmentOutcome({ item, onOpenTab }) {
  if (item.status !== 'completed' || item.examCode) return null;
  const formulas = item.formulas ? item.formulas.split(',') : [];
  const orders = parseOrders(item.orders);
  return (
    <div className="outcome">
      {item.diagnosis && <p className="outcome__dx"><strong>Diagnóstico:</strong> {item.diagnosis}</p>}
      {item.clinicalNotes && <p className="outcome__notes">{item.clinicalNotes}</p>}
      <div className="outcome__chips">
        {formulas.map(number => (
          <button type="button" key={number} className="outcome__chip outcome__chip--rx" onClick={() => onOpenTab?.('medicamentos')} disabled={!onOpenTab}>
            💊 Fórmula {number}
          </button>
        ))}
        {orders.map(order => (
          <button type="button" key={order.id} className={`outcome__chip outcome__chip--${order.status}`} onClick={() => onOpenTab?.('autorizaciones')} disabled={!onOpenTab}>
            📄 {order.service} · {AUTH_STATUS[order.status] || order.status}
          </button>
        ))}
        {!formulas.length && !orders.length && <span className="outcome__none">Sin medicamentos ni órdenes de autorización.</span>}
      </div>
    </div>
  );
}
