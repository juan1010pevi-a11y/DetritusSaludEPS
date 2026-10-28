import { addDays, weekdayOf } from './clinical-catalog.js';

export const PQRS_TYPES = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Denuncia'];

/** Fecha límite legal: 15 días hábiles (30 para denuncias), sin contar sábados ni domingos. */
export function dueDateFor(type, from) {
  let remaining = type === 'Denuncia' ? 30 : 15;
  let date = from;
  while (remaining > 0) {
    date = addDays(date, 1);
    if (![0, 6].includes(weekdayOf(date))) remaining -= 1;
  }
  return date;
}
