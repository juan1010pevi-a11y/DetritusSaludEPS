// Catálogos clínicos y utilidades de agenda compartidas por los microservicios.

export const LAB_SPECIALTY = 'Laboratorio clínico';

export const SPECIALTIES = [
  'Medicina general',
  'Medicina interna',
  'Pediatría',
  'Odontología',
  'Psicología',
  LAB_SPECIALTY,
];

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Exámenes de laboratorio que se pueden agendar. Cada parámetro tiene su rango
 * de referencia; `low`/`high` permiten marcar automáticamente valores alterados.
 */
export const LAB_EXAMS = [
  {
    code: 'HEMOGRAMA',
    name: 'Hemograma completo',
    sample: 'Sangre total (tubo tapa lila)',
    preparation: 'No requiere ayuno.',
    parameters: [
      { name: 'Hemoglobina', unit: 'g/dL', reference: '12.0 - 17.5', low: 12, high: 17.5 },
      { name: 'Hematocrito', unit: '%', reference: '36 - 52', low: 36, high: 52 },
      { name: 'Leucocitos', unit: 'x10³/µL', reference: '4.5 - 11.0', low: 4.5, high: 11 },
      { name: 'Neutrófilos', unit: '%', reference: '40 - 70', low: 40, high: 70 },
      { name: 'Linfocitos', unit: '%', reference: '20 - 45', low: 20, high: 45 },
      { name: 'Plaquetas', unit: 'x10³/µL', reference: '150 - 450', low: 150, high: 450 },
    ],
  },
  {
    code: 'GLICEMIA',
    name: 'Glicemia en ayunas',
    sample: 'Suero',
    preparation: 'Ayuno de 8 a 12 horas.',
    parameters: [
      { name: 'Glucosa en ayunas', unit: 'mg/dL', reference: '70 - 100', low: 70, high: 100 },
    ],
  },
  {
    code: 'LIPIDOS',
    name: 'Perfil lipídico',
    sample: 'Suero',
    preparation: 'Ayuno de 12 horas. Evita alcohol 24 horas antes.',
    parameters: [
      { name: 'Colesterol total', unit: 'mg/dL', reference: '< 200', high: 200 },
      { name: 'Colesterol HDL', unit: 'mg/dL', reference: '> 40', low: 40 },
      { name: 'Colesterol LDL', unit: 'mg/dL', reference: '< 130', high: 130 },
      { name: 'Triglicéridos', unit: 'mg/dL', reference: '< 150', high: 150 },
    ],
  },
  {
    code: 'CREATININA',
    name: 'Creatinina en suero',
    sample: 'Suero',
    preparation: 'No requiere ayuno.',
    parameters: [
      { name: 'Creatinina', unit: 'mg/dL', reference: '0.6 - 1.2', low: 0.6, high: 1.2 },
    ],
  },
  {
    code: 'TSH',
    name: 'Hormona estimulante de tiroides (TSH)',
    sample: 'Suero',
    preparation: 'No requiere ayuno.',
    parameters: [
      { name: 'TSH', unit: 'µUI/mL', reference: '0.4 - 4.0', low: 0.4, high: 4 },
    ],
  },
  {
    code: 'UROANALISIS',
    name: 'Uroanálisis',
    sample: 'Orina (primera de la mañana)',
    preparation: 'Recoge la primera orina de la mañana en frasco estéril.',
    parameters: [
      { name: 'Color', unit: '', reference: 'Amarillo' },
      { name: 'Aspecto', unit: '', reference: 'Claro' },
      { name: 'pH', unit: '', reference: '5.0 - 7.5', low: 5, high: 7.5 },
      { name: 'Densidad', unit: '', reference: '1.005 - 1.030', low: 1.005, high: 1.03 },
      { name: 'Proteínas', unit: '', reference: 'Negativo' },
      { name: 'Glucosa', unit: '', reference: 'Negativo' },
      { name: 'Leucocitos', unit: 'x campo', reference: '0 - 5', low: 0, high: 5 },
    ],
  },
];

export function findLabExam(code) {
  return LAB_EXAMS.find(exam => exam.code === code) || null;
}

/** Marca un valor como alto (H) o bajo (L) según los límites del parámetro. */
export function flagFor(parameter, value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  if (value === '' || value == null || Number.isNaN(number)) return '';
  if (parameter.low != null && number < parameter.low) return 'L';
  if (parameter.high != null && number > parameter.high) return 'H';
  return '';
}

// ---------- Fechas en hora de Colombia ----------

const bogotaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function bogotaNow() {
  // Las pruebas automáticas fijan la hora (FAKE_NOW=2026-11-02T06:00) para que los resultados no dependan del día.
  const fake = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(process.env.FAKE_NOW || '');
  if (fake) return { date: fake[1], minutes: Number(fake[2]) * 60 + Number(fake[3]), iso: `${fake[1]}T${fake[2]}:${fake[3]}:00-05:00` };
  const parts = Object.fromEntries(bogotaFormatter.formatToParts(new Date()).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    iso: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00-05:00`,
  };
}

export function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

export function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

export function weekdayOf(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function toMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

export function toTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Genera los cupos (HH:MM) de un bloque de horario según la duración de la consulta. */
export function slotsForBlock(startTime, endTime, slotMinutes) {
  const slots = [];
  const end = toMinutes(endTime);
  for (let t = toMinutes(startTime); t + slotMinutes <= end; t += slotMinutes) slots.push(toTime(t));
  return slots;
}

/** Valida que los bloques de horario sean coherentes y no se crucen en el mismo día. */
export function validateScheduleBlocks(blocks) {
  if (!Array.isArray(blocks)) return 'El horario debe ser una lista de bloques.';
  const byDay = new Map();
  for (const block of blocks) {
    const weekday = Number(block.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return 'Día de la semana inválido.';
    if (!isValidTime(block.start) || !isValidTime(block.end)) return 'Las horas deben tener formato HH:MM.';
    if (toMinutes(block.start) >= toMinutes(block.end)) return `En ${WEEKDAYS[weekday]} la hora de inicio debe ser menor a la de fin.`;
    const list = byDay.get(weekday) || [];
    list.push([toMinutes(block.start), toMinutes(block.end)]);
    byDay.set(weekday, list);
  }
  for (const [weekday, list] of byDay) {
    list.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < list.length; i += 1) {
      if (list[i][0] < list[i - 1][1]) return `Hay bloques que se cruzan el ${WEEKDAYS[weekday]}.`;
    }
  }
  return null;
}

// ---------- Autorizaciones de servicios ----------
export const AUTHORIZATION_SERVICES = [
  { code: 'RM-SIMPLE', name: 'Resonancia magnética simple', category: 'Examen diagnóstico', provider: 'Imágenes Diagnósticas Chapinero - Calle 63 # 13-40' },
  { code: 'TAC', name: 'Tomografía axial computarizada (TAC)', category: 'Examen diagnóstico', provider: 'Imágenes Diagnósticas Chapinero - Calle 63 # 13-40' },
  { code: 'ECO-ABD', name: 'Ecografía abdominal total', category: 'Examen diagnóstico', provider: 'IPS Detritus Suba - Av. Suba # 115-40' },
  { code: 'TERAPIA-FIS', name: 'Terapia física (10 sesiones)', category: 'Procedimiento', provider: 'Centro de Rehabilitación Kennedy - Av. 1 de Mayo # 70-15' },
  { code: 'CARDIO', name: 'Consulta especializada: Cardiología', category: 'Consulta especializada', provider: 'Clínica Aliada del Country - Cra. 16 # 82-57' },
  { code: 'DERMA', name: 'Consulta especializada: Dermatología', category: 'Consulta especializada', provider: 'Clínica Aliada del Country - Cra. 16 # 82-57' },
  { code: 'ORTO', name: 'Consulta especializada: Ortopedia', category: 'Consulta especializada', provider: 'Clínica Aliada del Country - Cra. 16 # 82-57' },
  { code: 'CIRUGIA-AMB', name: 'Cirugía ambulatoria', category: 'Procedimiento', provider: 'Clínica Aliada del Country - Cra. 16 # 82-57' },
  { code: 'MED-NOPBS', name: 'Medicamento NO PBS (MIPRES)', category: 'Medicamento', provider: 'Farmacia Detritus Central - Cra. 13 # 54-20' },
];

export function findAuthorizationService(code) {
  return AUTHORIZATION_SERVICES.find(service => service.code === code) || null;
}

// ---------- Farmacia ----------
export const MEDICATIONS = [
  'Acetaminofén 500 mg tableta',
  'Ibuprofeno 400 mg tableta',
  'Naproxeno 250 mg tableta',
  'Amoxicilina 500 mg cápsula',
  'Azitromicina 500 mg tableta',
  'Losartán 50 mg tableta',
  'Enalapril 20 mg tableta',
  'Metformina 850 mg tableta',
  'Atorvastatina 20 mg tableta',
  'Omeprazol 20 mg cápsula',
  'Loratadina 10 mg tableta',
  'Salbutamol 100 mcg inhalador',
  'Sales de rehidratación oral sobre',
];

export const DELIVERY_POINTS = [
  'Farmacia Detritus Central - Cra. 13 # 54-20 (Chapinero)',
  'Droguería aliada Calle 80 - Av. Calle 80 # 70-10',
  'Farmacia Detritus Suba - Av. Suba # 115-40',
  'Farmacia Detritus Kennedy - Av. 1 de Mayo # 70-15',
  'Domicilio (dirección registrada del afiliado)',
];

// ---------- Afiliación ----------
export const DOCUMENT_TYPES = ['CC', 'CE', 'PA', 'PPT', 'TI', 'RC'];
export const RELATIONSHIPS = ['Cónyuge o compañero(a) permanente', 'Hijo(a)', 'Hijo(a) del cónyuge', 'Padre o madre'];
