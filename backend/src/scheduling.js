import { slotsForBlock, toMinutes, weekdayOf } from './clinical-catalog.js';

/**
 * Reglas de agenda. Una cita ocupa el intervalo [inicio, inicio + duración).
 * Dos citas se cruzan si sus intervalos se solapan, aunque no empiecen a la
 * misma hora (por ejemplo 8:00–8:30 y 8:20–8:40 se cruzan).
 */

// Estados que ocupan el tiempo del médico (una cita atendida o con inasistencia ya usó el cupo).
export const DOCTOR_BUSY_STATUSES = ['requested', 'confirmed', 'completed', 'no_show'];
// Estados que ocupan el tiempo del paciente (solo citas por venir).
export const PATIENT_BUSY_STATUSES = ['requested', 'confirmed'];

export function overlaps(startA, minutesA, startB, minutesB) {
  const a = toMinutes(startA);
  const b = toMinutes(startB);
  return a < b + minutesB && b < a + minutesA;
}

/** Cupos (HH:MM) del horario semanal de un médico para una fecha. */
export function slotsOfDoctorOnDate(doctor, blocks, date) {
  const weekday = weekdayOf(date);
  return blocks
    .filter(block => block.weekday === weekday)
    .flatMap(block => slotsForBlock(block.start, block.end, doctor.slotMinutes));
}

/** Primera cita de la lista que se cruza con [time, time + minutes), o null. */
export function firstConflict(time, minutes, appointments) {
  return appointments.find(item => item.time && overlaps(time, minutes, item.time, item.duration || minutes)) || null;
}

/**
 * Devuelve el motivo por el que un cupo NO se puede asignar, o null si está libre.
 *  - doctorBusy: citas del médico ese día (con hora y duración)
 *  - patientBusy: citas activas del paciente ese día (con cualquier médico)
 *  - absent: el médico tiene incapacidad/vacaciones ese día
 */
export function slotProblem({ doctor, blocks, date, time, doctorBusy = [], patientBusy = [], absent = false, now = null, minLeadMinutes = 0 }) {
  if (absent) return `${doctor.name} no atiende ese día por una novedad (incapacidad, vacaciones o licencia).`;
  if (!slotsOfDoctorOnDate(doctor, blocks, date).includes(time)) return `${doctor.name} no tiene ese horario disponible.`;
  if (now && date === now.date && toMinutes(time) <= now.minutes + minLeadMinutes) return 'Ese horario ya no está disponible para hoy.';
  if (now && date < now.date) return 'No se pueden asignar citas en fechas pasadas.';
  const doctorConflict = firstConflict(time, doctor.slotMinutes, doctorBusy);
  if (doctorConflict) return 'Ese cupo acaba de ser asignado a otro paciente. Elige otro horario.';
  const patientConflict = firstConflict(time, doctor.slotMinutes, patientBusy);
  if (patientConflict) {
    return `Ya tienes una cita de ${patientConflict.specialty} a las ${patientConflict.time} que se cruza con ese horario. Elige otra hora.`;
  }
  return null;
}

/** Cupos libres de un médico en una fecha aplicando todas las reglas anteriores. */
export function freeSlots(options) {
  if (options.absent) return [];
  return slotsOfDoctorOnDate(options.doctor, options.blocks, options.date)
    .filter(time => !slotProblem({ ...options, time }));
}
