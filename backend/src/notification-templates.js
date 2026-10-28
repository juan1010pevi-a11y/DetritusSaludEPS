// Mensajes que reciben los usuarios por correo, SMS y WhatsApp según el evento.
// Cada plantilla devuelve { subject, body, short, reference } o null si el evento no se notifica.

const STATUS_PQRS = { received: 'Recibida', in_review: 'En revisión', answered: 'Respondida', closed: 'Cerrada' };
const ABSENCE = { incapacidad: 'incapacidad médica', vacaciones: 'vacaciones', licencia: 'licencia', calamidad: 'calamidad doméstica', capacitacion: 'capacitación' };

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}

function formatTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'p. m.' : 'a. m.'}`;
}

const when = p => `${formatDate(p.date)} a las ${formatTime(p.time)}`;

const TEMPLATES = {
  manual: p => ({ subject: p.subject, body: p.message, short: `Detritus Salud: ${p.subject}. ${p.message}`.slice(0, 300) }),
  'user.registered': () => ({
    subject: 'Bienvenido a Detritus Salud EPS',
    body: 'Tu cuenta quedó creada. Ya puedes ingresar al portal con tu número de documento y contraseña para agendar citas, consultar resultados y radicar PQRS.',
    short: 'Detritus Salud: tu cuenta quedó creada. Ingresa con tu documento y contraseña.',
  }),
  'affiliation.created': p => ({
    subject: `Afiliación radicada ${p.id}`,
    body: `Recibimos tu Formulario Único de Afiliación con el radicado ${p.id} (${p.plan}). Tus servicios de salud quedan activos desde el ${formatDate(p.effectiveDate)}.`,
    short: `Detritus Salud: afiliación radicada ${p.id}. Servicios activos desde ${p.effectiveDate}.`,
    reference: p.id,
  }),
  'profile.updated': () => ({
    subject: 'Actualizaste tus datos de contacto',
    body: 'Los datos de contacto de tu cuenta se actualizaron. Si no fuiste tú, comunícate de inmediato con la línea de atención.',
    short: 'Detritus Salud: tus datos de contacto se actualizaron. Si no fuiste tú, llámanos.',
  }),
  'password.reset_requested': p => ({
    subject: 'Código para restablecer tu contraseña',
    body: `Tu código de verificación es ${p.code}. Vence en ${p.minutes} minutos. Si no solicitaste el cambio de contraseña, ignora este mensaje: nadie del equipo de Detritus Salud te pedirá este código.`,
    short: `Detritus Salud: tu código para restablecer la contraseña es ${p.code}. Vence en ${p.minutes} min. No lo compartas.`,
    secret: p.code,
  }),
  'password.changed': () => ({
    subject: 'Tu contraseña fue cambiada',
    body: 'La contraseña de tu cuenta se cambió correctamente. Si no fuiste tú, comunícate de inmediato con la línea de atención.',
    short: 'Detritus Salud: tu contraseña fue cambiada. Si no fuiste tú, llámanos.',
  }),
  'appointment.created': p => ({
    subject: `Cita confirmada: ${p.specialty}`,
    body: `Tu cita de ${p.specialty} quedó confirmada para el ${when(p)} con ${p.doctorName || 'el profesional asignado'}.\nModalidad: ${p.modality}. Lugar: ${p.site}.${p.labOrderNumber ? `\nOrden de laboratorio: ${p.labOrderNumber}.` : ''}${p.preparation ? `\nPreparación: ${p.preparation}` : ''}\nLlega 15 minutos antes con tu documento. Si no puedes asistir, cancela desde el portal para liberar el cupo.`,
    short: `Detritus Salud: cita de ${p.specialty} el ${p.date} ${p.time} con ${p.doctorName || 'tu profesional'}. ${p.site}.`,
    reference: p.id,
  }),
  'appointment.updated': p => {
    if (p.status === 'cancelled') {
      return {
        subject: `Cita cancelada: ${p.specialty}`,
        body: `Tu cita de ${p.specialty} del ${when(p)} fue cancelada${p.cancelledBy ? ` por ${p.cancelledBy}` : ''}. Puedes agendar una nueva desde el portal.`,
        short: `Detritus Salud: tu cita de ${p.specialty} del ${p.date} ${p.time} fue cancelada.`,
        reference: p.id,
      };
    }
    if (p.status === 'completed' && !p.examCode) {
      return {
        subject: 'Gracias por asistir a tu cita',
        body: `Registramos tu atención de ${p.specialty} con ${p.doctorName}. El resumen quedó en tu historia clínica; las fórmulas y órdenes aparecen en el portal.`,
        short: `Detritus Salud: tu atención de ${p.specialty} quedó registrada. Revisa fórmulas y órdenes en el portal.`,
        reference: p.id,
      };
    }
    if (p.status === 'completed' && p.examCode) {
      return {
        subject: 'Muestra de laboratorio tomada',
        body: `Tomamos la muestra de tu orden ${p.labOrderNumber}. Te avisaremos cuando el resultado esté disponible.`,
        short: `Detritus Salud: muestra tomada (orden ${p.labOrderNumber}). Te avisaremos cuando haya resultado.`,
        reference: p.labOrderNumber,
      };
    }
    if (p.status === 'no_show') {
      return {
        subject: 'Registramos tu inasistencia',
        body: `No asististe a tu cita de ${p.specialty} del ${when(p)}. Recuerda cancelar con anticipación para que otro paciente pueda usar el cupo.`,
        short: `Detritus Salud: no asististe a tu cita del ${p.date} ${p.time}.`,
        reference: p.id,
      };
    }
    return null;
  },
  'appointment.reassigned': p => ({
    subject: `Cambio de profesional en tu cita de ${p.specialty}`,
    body: `Por ${ABSENCE[p.absenceType] || 'novedad'} de ${p.previousDoctorName}, tu cita del ${when(p)} fue reasignada a ${p.doctorName} (${p.site}). La fecha y la hora no cambian.`,
    short: `Detritus Salud: tu cita del ${p.date} ${p.time} ahora es con ${p.doctorName}. Misma fecha y hora.`,
    reference: p.id,
  }),
  'appointment.reschedule_required': p => ({
    subject: `Debes reprogramar tu cita de ${p.specialty}`,
    body: `Por ${ABSENCE[p.absenceType] || 'novedad'} de ${p.previousDoctorName}, tu cita del ${when(p)} no se podrá realizar y no encontramos otro profesional a esa misma hora. Ingresa al portal y elige un nuevo horario en “Mis próximas citas → Reprogramar”; tu cita conserva su prioridad.`,
    short: `Detritus Salud: tu cita del ${p.date} ${p.time} debe reprogramarse por ${ABSENCE[p.absenceType] || 'novedad'} del médico. Entra al portal.`,
    reference: p.id,
  }),
  'appointment.rescheduled': p => ({
    subject: `Cita reprogramada: ${p.specialty}`,
    body: `Tu cita de ${p.specialty} quedó reprogramada para el ${when(p)} con ${p.doctorName} (${p.site}).`,
    short: `Detritus Salud: cita reprogramada para el ${p.date} ${p.time} con ${p.doctorName}.`,
    reference: p.id,
  }),
  'authorization.created': p => ({
    subject: `Solicitud de autorización ${p.id}`,
    body: `Recibimos la solicitud de autorización para ${p.serviceName} (${p.id}). Auditoría médica la revisará y te avisaremos la decisión.`,
    short: `Detritus Salud: recibimos tu solicitud ${p.id} para ${p.serviceName}.`,
    reference: p.id,
  }),
  'authorization.updated': p => (p.status === 'approved'
    ? {
      subject: `Autorización aprobada ${p.authNumber}`,
      body: `Tu solicitud ${p.id} para ${p.serviceName} fue APROBADA con el número ${p.authNumber}.\nPrestador: ${p.provider}.\nVigente hasta: ${formatDate(p.validUntil)}.`,
      short: `Detritus Salud: autorización ${p.authNumber} aprobada para ${p.serviceName}. Prestador: ${p.provider}.`,
      reference: p.authNumber,
    }
    : {
      subject: `Solicitud de autorización ${p.id} negada`,
      body: `Tu solicitud ${p.id} para ${p.serviceName} fue negada. Motivo: ${p.decisionNotes}. Puedes radicar una PQRS si no estás de acuerdo.`,
      short: `Detritus Salud: la solicitud ${p.id} fue negada. Revisa el motivo en el portal.`,
      reference: p.id,
    }),
  'prescription.created': p => ({
    subject: `Fórmula médica ${p.id}`,
    body: `Tu médico emitió la fórmula ${p.id}${p.items ? ` con ${p.items} medicamento(s)` : ''}. Te avisaremos cuando esté lista para entrega.`,
    short: `Detritus Salud: fórmula ${p.id} emitida. Te avisaremos cuando esté lista.`,
    reference: p.id,
  }),
  'prescription.updated': p => (p.status === 'available'
    ? {
      subject: `Tus medicamentos están listos (${p.id})`,
      body: `Los medicamentos de la fórmula ${p.id} están listos para reclamar en: ${p.deliveryPoint}. Lleva tu documento.`,
      short: `Detritus Salud: fórmula ${p.id} lista en ${p.deliveryPoint}.`,
      reference: p.id,
    }
    : p.status === 'delivered'
      ? {
        subject: `Medicamentos entregados (${p.id})`,
        body: `Registramos la entrega de los medicamentos de la fórmula ${p.id}.`,
        short: `Detritus Salud: fórmula ${p.id} entregada.`,
        reference: p.id,
      }
      : null),
  'lab-result.available': p => ({
    subject: `Resultado de laboratorio disponible (${p.orderNumber})`,
    body: `El resultado de tu examen ${p.testName || ''} (orden ${p.orderNumber}) ya está disponible. Consúltalo en el portal o en “Resultados de laboratorio” con tu documento y el número de orden.`,
    short: `Detritus Salud: resultado de la orden ${p.orderNumber} disponible en el portal.`,
    reference: p.orderNumber,
  }),
  'pqrs.created': p => ({
    subject: `PQRS radicada ${p.id}`,
    body: `Recibimos tu ${String(p.type).toLowerCase()} “${p.subject}” con el radicado ${p.id}. Te responderemos a más tardar el ${formatDate(p.dueDate)}. Consulta el estado con el radicado y tu documento.`,
    short: `Detritus Salud: PQRS radicada ${p.id}. Respuesta máxima: ${p.dueDate}.`,
    reference: p.id,
  }),
  'pqrs.updated': p => ({
    subject: `Tu PQRS ${p.id} está ${STATUS_PQRS[p.status]?.toLowerCase() || p.status}`,
    body: `Tu solicitud ${p.id} cambió a estado: ${STATUS_PQRS[p.status] || p.status}.${p.response ? `\n\nRespuesta de la EPS:\n${p.response}` : ''}`,
    short: `Detritus Salud: tu PQRS ${p.id} está ${STATUS_PQRS[p.status]?.toLowerCase() || p.status}. Revisa el detalle en el portal.`,
    reference: p.id,
  }),
  'doctor.absence.created': p => ({
    subject: `Novedad registrada: ${ABSENCE[p.type] || p.type}`,
    body: `Se registró tu ${ABSENCE[p.type] || p.type} del ${formatDate(p.startDate)} al ${formatDate(p.endDate)}. Citas afectadas: ${p.affected}. Reasignadas a otro profesional: ${p.reassigned}. Pendientes de reprogramar por el paciente: ${p.toReschedule}. No recibirás citas nuevas en esas fechas.`,
    short: `Detritus Salud: ${ABSENCE[p.type] || p.type} registrada del ${p.startDate} al ${p.endDate}. ${p.affected} cita(s) gestionadas.`,
    reference: p.id,
  }),
};

export function renderNotification(type, payload, recipientName) {
  const template = TEMPLATES[type];
  if (!template) return null;
  const message = template(payload || {});
  if (!message) return null;
  const greeting = recipientName ? `Hola, ${recipientName.split(' ')[0]}:\n\n` : '';
  return {
    ...message,
    body: `${greeting}${message.body}\n\n—\nDetritus Salud E.P.S. · Este es un mensaje automático, no lo respondas.`,
  };
}

export const NOTIFIED_EVENTS = Object.keys(TEMPLATES);
