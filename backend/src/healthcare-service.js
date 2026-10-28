import { startService, json, readJson, HttpError } from './service.js';
import { publishEvent } from './broker.js';
import { createDatabase } from './database.js';
import { getAuthenticatedUser, requireRole, ROLE_LABELS } from './auth.js';
import { callService, peopleById, personByDocument, requireInternal, tryCallService } from './internal.js';
import {
  addDays, AUTHORIZATION_SERVICES, bogotaNow, findAuthorizationService, findLabExam, isValidDate, isValidTime, LAB_EXAMS, LAB_SPECIALTY,
  SPECIALTIES, validateScheduleBlocks, WEEKDAYS, weekdayOf,
} from './clinical-catalog.js';
import { DOCTOR_BUSY_STATUSES, freeSlots, PATIENT_BUSY_STATUSES, slotProblem, slotsOfDoctorOnDate } from './scheduling.js';
import { DEMO_DOCTORS } from './seed-data.js';
import { bloodPressureError, documentError, numberInRangeError } from './validators.js';

const MAX_BOOKING_DAYS = 30;          // ventana de agenda abierta
const MIN_MINUTES_BEFORE_SLOT = 30;   // no se ofrecen cupos que empiezan en menos de 30 min
const CLOSED_STATUSES = ['completed', 'cancelled', 'no_show'];
const OPEN_STATUSES = ['requested', 'confirmed', 'reschedule_required'];
const ABSENCE_TYPES = ['incapacidad', 'vacaciones', 'licencia', 'calamidad', 'capacitacion'];
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const db = await createDatabase('healthcare', {
  seed(database) {
    for (const [id, specialty, license, site, slotMinutes, blocks] of DEMO_DOCTORS) {
      database.execute('INSERT OR IGNORE INTO dim_doctors (doctor_id, specialty, license, site, slot_minutes) VALUES (?, ?, ?, ?, ?)',
        [id, specialty, license, site, slotMinutes]);
      if (!database.queryOne('SELECT 1 AS ok FROM doctor_schedules WHERE doctor_id = ? LIMIT 1', [id])) {
        blocks.forEach(([weekday, start, end]) => database.execute(
          'INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)', [id, weekday, start, end],
        ));
      }
    }
    // Historia clínica de demostración del afiliado demo: una consulta anterior ya atendida.
    if (!database.queryOne("SELECT 1 AS ok FROM fact_appointments WHERE appointment_id = 'CITA-DEMO-0001'")) {
      const past = addDays(bogotaNow().date, -21);
      database.execute(
        `INSERT INTO fact_appointments (appointment_id, affiliate_id, specialty, appointment_date, appointment_time, duration_minutes,
           status, doctor_id, modality, site, reason, diagnosis, clinical_notes, updated_at)
         VALUES ('CITA-DEMO-0001', 'user-001', 'Medicina general', ?, '08:00', 20, 'completed', 'staff-doctor', 'Presencial',
           'Sede Chapinero - Cra. 13 # 54-20', 'Control de presión arterial', 'Hipertensión esencial (I10)',
           'Continuar Losartán 50 mg cada 12 horas. Dieta baja en sal. Control en 3 meses.', ?)`,
        [past, `${past}T08:20:00-05:00`],
      );
      database.execute(
        `INSERT INTO clinical_encounters (encounter_id, appointment_id, patient_id, doctor_id, doctor_name, specialty, encounter_date,
           chief_complaint, current_illness, blood_pressure, heart_rate, respiratory_rate, temperature, weight_kg, height_cm,
           oxygen_saturation, physical_exam, diagnosis, diagnosis_code, plan, created_at)
         VALUES ('HC-DEMO-0001', 'CITA-DEMO-0001', 'user-001', 'staff-doctor', 'Médico demo', 'Medicina general', ?,
           'Control de presión arterial', 'Paciente con hipertensión diagnosticada hace 2 años, adherente al tratamiento, sin síntomas.',
           '138/88', 76, 16, 36.5, 82, 172, 97, 'Ruidos cardiacos rítmicos, sin soplos. Pulmones limpios. Sin edemas.',
           'Hipertensión esencial', 'I10', 'Continuar Losartán 50 mg cada 12 horas. Dieta baja en sal. Control en 3 meses.', ?)`,
        [past, `${past}T08:20:00-05:00`],
      );
      database.execute(
        `INSERT OR IGNORE INTO clinical_backgrounds (patient_id, blood_type, allergies, personal_history, family_history,
           surgical_history, current_medications, habits, updated_by, updated_at)
         VALUES ('user-001', 'O+', 'Penicilina', 'Hipertensión arterial', 'Padre con diabetes tipo 2', 'Apendicectomía (2015)',
           'Losartán 50 mg cada 12 horas', 'No fuma. Actividad física 2 veces por semana.', 'Médico demo', ?)`,
        [`${past}T08:20:00-05:00`],
      );
    }
  },
});
const { execute, queryOne, queryRows } = db;

// ---------- Médicos ----------

function scheduleOf(doctorId) {
  return queryRows(
    'SELECT weekday, start_time AS start, end_time AS end FROM doctor_schedules WHERE doctor_id = ? ORDER BY weekday, start_time',
    [doctorId],
  );
}

function absencesOf(doctorId, from, to) {
  return queryRows(
    `SELECT absence_id AS id, doctor_id AS doctorId, type, start_date AS startDate, end_date AS endDate, notes,
            created_by AS createdBy, created_at AS createdAt
     FROM doctor_absences
     WHERE cancelled_at IS NULL ${doctorId ? 'AND doctor_id = ?' : ''} AND end_date >= ? AND start_date <= ?
     ORDER BY start_date`,
    doctorId ? [doctorId, from, to] : [from, to],
  );
}

const isAbsent = (doctorId, date) => absencesOf(doctorId, date, date).length > 0;

/** Ficha local (especialidad, horario) + datos de la persona en users-service. */
async function doctorDirectory({ specialty, doctorId, onlyActive = true } = {}) {
  const people = await callService('users', '/internal/people?role=doctor');
  const byId = new Map(people.items.map(person => [person.id, person]));
  const filters = [];
  const params = [];
  if (specialty) { filters.push('specialty = ?'); params.push(specialty); }
  if (doctorId) { filters.push('doctor_id = ?'); params.push(doctorId); }
  if (onlyActive) filters.push('active = 1');
  return queryRows(
    `SELECT doctor_id AS id, specialty, license, site, slot_minutes AS slotMinutes, active
     FROM dim_doctors ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}`,
    params,
  )
    .filter(doctor => byId.has(doctor.id) && (!onlyActive || byId.get(doctor.id).status === 'active'))
    .map(doctor => ({ ...doctor, name: byId.get(doctor.id).name, document: byId.get(doctor.id).document }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

async function doctorProfile(doctorId) {
  const person = (await peopleById([doctorId])).get(doctorId);
  if (!person) return null;
  const doc = queryOne('SELECT specialty, license, site, slot_minutes AS slotMinutes, active FROM dim_doctors WHERE doctor_id = ?', [doctorId]);
  const today = bogotaNow().date;
  return {
    id: doctorId, name: person.name, document: person.document,
    specialty: doc?.specialty || null, license: doc?.license || null, site: doc?.site || null,
    slotMinutes: doc?.slotMinutes || 20, active: doc ? doc.active : 0, hasProfile: doc ? 1 : 0,
    blocks: scheduleOf(doctorId),
    absences: absencesOf(doctorId, today, addDays(today, 365)),
  };
}

// ---------- Ocupación de la agenda ----------

function doctorBusy(doctorId, date, excludeId = null) {
  return queryRows(
    `SELECT appointment_id AS id, appointment_time AS time, duration_minutes AS duration, specialty
     FROM fact_appointments
     WHERE doctor_id = ? AND appointment_date = ? AND status IN (${DOCTOR_BUSY_STATUSES.map(() => '?').join(',')})
       AND appointment_id <> COALESCE(?, '')`,
    [doctorId, date, ...DOCTOR_BUSY_STATUSES, excludeId],
  );
}

function patientBusy(patientId, date, excludeId = null) {
  if (!patientId) return [];
  return queryRows(
    `SELECT appointment_id AS id, appointment_time AS time, duration_minutes AS duration, specialty
     FROM fact_appointments
     WHERE affiliate_id = ? AND appointment_date = ? AND status IN (${PATIENT_BUSY_STATUSES.map(() => '?').join(',')})
       AND appointment_id <> COALESCE(?, '')`,
    [patientId, date, ...PATIENT_BUSY_STATUSES, excludeId],
  );
}

/** Verifica un cupo con todas las reglas (horario, ausencias, cruces del médico y del paciente). */
function checkSlot({ doctor, date, time, patientId, excludeId, enforceLead = true }) {
  return slotProblem({
    doctor,
    blocks: scheduleOf(doctor.id),
    date,
    time,
    doctorBusy: doctorBusy(doctor.id, date, excludeId),
    patientBusy: patientBusy(patientId, date, excludeId),
    absent: isAbsent(doctor.id, date),
    now: enforceLead ? bogotaNow() : null,
    minLeadMinutes: MIN_MINUTES_BEFORE_SLOT,
  });
}

async function computeAvailability({ specialty, doctorId, from, days, viewerId, excludeAppointmentId }) {
  const now = bogotaNow();
  const lastDay = addDays(now.date, MAX_BOOKING_DAYS);
  const start = isValidDate(from) && from > now.date ? from : now.date;
  const totalDays = Math.min(Math.max(Number(days) || 14, 1), MAX_BOOKING_DAYS);
  // Un médico no puede agendarse cita consigo mismo.
  const doctors = (await doctorDirectory({ specialty, doctorId })).filter(doctor => doctor.id !== viewerId);
  const blocksByDoctor = new Map(doctors.map(doctor => [doctor.id, scheduleOf(doctor.id)]));

  const result = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDays(start, offset);
    if (date > lastDay) break;
    const mine = patientBusy(viewerId, date, excludeAppointmentId);
    const slots = [];
    for (const doctor of doctors) {
      const times = freeSlots({
        doctor, blocks: blocksByDoctor.get(doctor.id), date,
        doctorBusy: doctorBusy(doctor.id, date), patientBusy: mine,
        absent: isAbsent(doctor.id, date), now, minLeadMinutes: MIN_MINUTES_BEFORE_SLOT,
      });
      times.forEach(time => slots.push({ doctorId: doctor.id, doctorName: doctor.name, time, site: doctor.site, duration: doctor.slotMinutes }));
    }
    slots.sort((a, b) => a.time.localeCompare(b.time) || a.doctorName.localeCompare(b.doctorName));
    result.push({ date, weekday: WEEKDAYS[weekdayOf(date)], total: slots.length, slots });
  }
  return { specialty, from: start, days: result, doctors: doctors.length };
}

// ---------- Citas ----------

const APPOINTMENT_COLUMNS = `
  appointment_id AS id, affiliate_id AS affiliateId, specialty, appointment_date AS date, appointment_time AS time,
  duration_minutes AS duration, status, modality, site, exam_code AS examCode, lab_order_number AS labOrderNumber,
  reason, doctor_id AS doctorId, original_doctor_id AS originalDoctorId, change_note AS changeNote,
  created_at AS createdAt, updated_at AS updatedAt, diagnosis, clinical_notes AS clinicalNotes,
  (SELECT GROUP_CONCAT(au.authorization_id || '~' || COALESCE(au.service_name, '') || '~' || au.status, '|')
     FROM fact_authorizations au WHERE au.appointment_id = fact_appointments.appointment_id) AS orders
`;

/** Completa las citas con datos de otros microservicios (nombres, fórmulas, estado del laboratorio). */
async function enrich(rows) {
  if (!rows.length) return [];
  const people = await peopleById(rows.flatMap(row => [row.affiliateId, row.doctorId, row.originalDoctorId]));
  const links = await tryCallService('meds-labs', `/internal/appointment-links?ids=${encodeURIComponent(rows.map(row => row.id).join(','))}`, {}, { items: {} });
  return rows.map(row => ({
    ...row,
    doctorName: people.get(row.doctorId)?.name || null,
    originalDoctorName: people.get(row.originalDoctorId)?.name || null,
    patientName: people.get(row.affiliateId)?.name || 'Paciente',
    patientDocument: people.get(row.affiliateId)?.document || '',
    patientPhone: people.get(row.affiliateId)?.phone || '',
    formulas: links.items[row.id]?.formulas || null,
    labStatus: links.items[row.id]?.labStatus || null,
  }));
}

const appointmentRow = id => queryOne(`SELECT ${APPOINTMENT_COLUMNS} FROM fact_appointments WHERE appointment_id = ?`, [id]);
const findAppointment = async id => (await enrich([appointmentRow(id)].filter(Boolean)))[0] || null;

function newAppointmentId() {
  return `CITA-${Date.now()}${Math.floor(Math.random() * 90 + 10)}`;
}

function serviceIdFor(specialty, isLab, date) {
  execute('INSERT OR IGNORE INTO dim_dates (date_key, date_value, year, month, day) VALUES (?, ?, ?, ?, ?)',
    [date, date, Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))]);
  execute('INSERT OR IGNORE INTO dim_services (name, category) VALUES (?, ?)', [specialty, isLab ? 'laboratorio' : 'consulta']);
  return queryOne('SELECT service_id FROM dim_services WHERE name = ?', [specialty])?.service_id || null;
}

async function resolvePatient(user, data) {
  if (user.role !== 'administrator') {
    const person = (await peopleById([user.sub])).get(user.sub);
    return person;
  }
  const docProblem = documentError(String(data.document || '').trim());
  if (docProblem) throw new HttpError(400, docProblem);
  const person = await personByDocument(data.document);
  if (!person) throw new HttpError(404, 'No existe un afiliado con ese documento.');
  return person;
}

/** Busca otro médico de la misma especialidad que pueda atender la cita a la misma hora. */
function findReplacement(appointment, candidates) {
  for (const candidate of candidates) {
    if (candidate.id === appointment.doctorId || candidate.id === appointment.affiliateId) continue;
    const problem = checkSlot({
      doctor: candidate, date: appointment.date, time: appointment.time,
      patientId: appointment.affiliateId, excludeId: appointment.id, enforceLead: false,
    });
    if (!problem) return candidate;
  }
  return null;
}

// ---------- Autorizaciones ----------

async function listAuthorizations(where, params) {
  const rows = queryRows(
    `SELECT au.authorization_id AS id, au.affiliate_id AS affiliateId, au.status,
            au.service_code AS serviceCode, COALESCE(au.service_name, s.name, 'Servicio de salud') AS serviceName,
            au.category, au.ordered_by AS orderedBy, au.order_reference AS orderReference, au.reason, au.priority,
            au.auth_number AS authNumber, au.provider, au.valid_until AS validUntil,
            au.decided_by AS decidedBy, au.decided_at AS decidedAt, au.decision_notes AS decisionNotes,
            au.created_at AS createdAt
     FROM fact_authorizations au
     LEFT JOIN dim_services s ON s.service_id = au.service_id
     ${where ? `WHERE ${where}` : ''}
     ORDER BY au.created_at DESC`,
    params,
  );
  const people = await peopleById(rows.map(row => row.affiliateId));
  return rows.map(row => ({
    ...row,
    patientName: people.get(row.affiliateId)?.name || 'Paciente',
    patientDocument: people.get(row.affiliateId)?.document || '',
    plan: people.get(row.affiliateId)?.plan || '',
  }));
}

// ---------- Historia clínica ----------

const ENCOUNTER_COLUMNS = `encounter_id AS id, appointment_id AS appointmentId, doctor_name AS doctorName, specialty,
  encounter_date AS date, chief_complaint AS chiefComplaint, current_illness AS currentIllness,
  blood_pressure AS bloodPressure, heart_rate AS heartRate, respiratory_rate AS respiratoryRate, temperature,
  weight_kg AS weightKg, height_cm AS heightCm, oxygen_saturation AS oxygenSaturation, physical_exam AS physicalExam,
  diagnosis, diagnosis_code AS diagnosisCode, plan, created_at AS createdAt`;

async function clinicalHistory(patientId) {
  const patient = (await peopleById([patientId])).get(patientId);
  if (!patient) throw new HttpError(404, 'Paciente no encontrado.');
  const background = queryOne(
    `SELECT blood_type AS bloodType, allergies, personal_history AS personalHistory, family_history AS familyHistory,
            surgical_history AS surgicalHistory, current_medications AS currentMedications, habits,
            updated_by AS updatedBy, updated_at AS updatedAt
     FROM clinical_backgrounds WHERE patient_id = ?`,
    [patientId],
  );
  const encounters = queryRows(`SELECT ${ENCOUNTER_COLUMNS} FROM clinical_encounters WHERE patient_id = ? ORDER BY encounter_date DESC, created_at DESC`, [patientId]);
  const orders = queryRows(
    `SELECT authorization_id AS id, appointment_id AS appointmentId, service_name AS serviceName, status, created_at AS createdAt
     FROM fact_authorizations WHERE affiliate_id = ? ORDER BY created_at DESC`,
    [patientId],
  );
  const summary = await tryCallService('meds-labs', `/internal/patient-summary?affiliateId=${encodeURIComponent(patientId)}`, {}, { prescriptions: [], labs: [] });
  return {
    patient: { id: patient.id, name: patient.name, document: patient.document, documentType: patient.documentType, plan: patient.plan, phone: patient.phone },
    background,
    encounters,
    orders,
    prescriptions: summary.prescriptions,
    labs: summary.labs,
  };
}

/** Un médico solo ve la historia de pacientes que tiene o tuvo en su agenda. */
function doctorTreatsPatient(doctorId, patientId) {
  return Boolean(queryOne('SELECT 1 AS ok FROM fact_appointments WHERE doctor_id = ? AND affiliate_id = ? LIMIT 1', [doctorId, patientId]));
}

function validateEncounter(data) {
  const vitals = data.vitals || {};
  return bloodPressureError(vitals.bloodPressure)
    || numberInRangeError(vitals.heartRate, { min: 30, max: 220, label: 'La frecuencia cardiaca', integer: true })
    || numberInRangeError(vitals.respiratoryRate, { min: 8, max: 60, label: 'La frecuencia respiratoria', integer: true })
    || numberInRangeError(vitals.temperature, { min: 34, max: 42, label: 'La temperatura' })
    || numberInRangeError(vitals.weightKg, { min: 1, max: 350, label: 'El peso' })
    || numberInRangeError(vitals.heightCm, { min: 30, max: 230, label: 'La talla' })
    || numberInRangeError(vitals.oxygenSaturation, { min: 50, max: 100, label: 'La saturación de oxígeno', integer: true })
    || (data.diagnosisCode && !/^[A-Z]\d{2}(\.?\d{1,2})?$/i.test(String(data.diagnosisCode).trim()) ? 'El código CIE-10 tiene el formato letra + 2 dígitos (ej. I10 o M54.5).' : null);
}

const num = value => (String(value ?? '').trim() === '' ? null : Number(String(value).replace(',', '.')));

startService({
  name: 'healthcare-service',
  serviceKey: 'healthcare',
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'healthcare-service', status: 'ok', database: db.file }),
    },
    {
      method: 'GET',
      path: '/specialties',
      handler: async (_req, res) => {
        const counts = Object.fromEntries(SPECIALTIES.map(name => [name, 0]));
        (await doctorDirectory()).forEach(doctor => { counts[doctor.specialty] = (counts[doctor.specialty] || 0) + 1; });
        return json(res, 200, {
          items: Object.entries(counts).map(([name, doctors]) => ({ name, doctors, isLab: name === LAB_SPECIALTY })),
          labExams: LAB_EXAMS.map(({ code, name, sample, preparation }) => ({ code, name, sample, preparation })),
          weekdays: WEEKDAYS,
        });
      },
    },
    {
      method: 'GET',
      path: '/doctors',
      handler: async (_req, res, url) => {
        const items = (await doctorDirectory({ specialty: url.searchParams.get('specialty') || undefined }))
          .map(({ document: _document, ...doctor }) => ({ ...doctor, blocks: scheduleOf(doctor.id) }));
        return json(res, 200, { items });
      },
    },
    {
      method: 'GET',
      path: '/availability',
      handler: async (req, res, url) => {
        const specialty = url.searchParams.get('specialty');
        if (!SPECIALTIES.includes(specialty)) return json(res, 400, { error: 'Selecciona una especialidad válida.' });
        const viewer = getAuthenticatedUser(req);
        // El administrador puede consultar la disponibilidad pensando en un paciente concreto.
        let viewerId = viewer?.role === 'administrator' ? null : viewer?.sub;
        if (viewer?.role === 'administrator' && url.searchParams.get('document')) {
          viewerId = (await personByDocument(url.searchParams.get('document')))?.id || null;
        }
        return json(res, 200, await computeAvailability({
          specialty,
          doctorId: url.searchParams.get('doctorId') || undefined,
          from: url.searchParams.get('from'),
          days: url.searchParams.get('days'),
          viewerId,
          excludeAppointmentId: url.searchParams.get('excludeAppointmentId'),
        }));
      },
    },
    {
      method: 'GET',
      path: '/appointments',
      handler: async (req, res, url) => {
        if (!requireRole(req, res, ['administrator'])) return;
        const affiliateId = url.searchParams.get('affiliateId');
        const rows = queryRows(
          `SELECT ${APPOINTMENT_COLUMNS} FROM fact_appointments ${affiliateId ? 'WHERE affiliate_id = ?' : ''}
           ORDER BY appointment_date DESC, appointment_time DESC LIMIT 300`,
          affiliateId ? [affiliateId] : [],
        );
        return json(res, 200, { items: await enrich(rows) });
      },
    },
    {
      method: 'GET',
      path: '/appointments/mine',
      handler: async (req, res) => {
        const user = requireRole(req, res);
        if (!user) return;
        const rows = queryRows(
          `SELECT ${APPOINTMENT_COLUMNS} FROM fact_appointments WHERE affiliate_id = ?
           ORDER BY appointment_date DESC, appointment_time DESC`,
          [user.sub],
        );
        return json(res, 200, { items: await enrich(rows), today: bogotaNow().date });
      },
    },
    {
      method: 'POST',
      path: '/appointments',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['affiliate', 'administrator']);
        if (!user) return;
        const data = await readJson(req);
        const specialty = String(data.specialty || '');
        const { doctorId, date, time } = data;
        const isLab = specialty === LAB_SPECIALTY;
        const modality = isLab ? 'Presencial' : (data.modality === 'Teleconsulta' ? 'Teleconsulta' : 'Presencial');
        if (!SPECIALTIES.includes(specialty)) return json(res, 400, { error: 'Especialidad no válida.' });
        if (!isValidDate(date) || !isValidTime(time)) return json(res, 400, { error: 'Selecciona un día y una hora disponibles.' });
        const exam = isLab ? findLabExam(data.examCode) : null;
        if (isLab && !exam) return json(res, 400, { error: 'Selecciona el examen de laboratorio que vas a realizar.' });
        const reason = String(data.reason || '').trim();
        if (reason.length > 300) return json(res, 400, { error: 'El motivo de la consulta no puede superar 300 caracteres.' });

        const patient = await resolvePatient(user, data);
        if (!patient?.roles.includes('affiliate') || patient.status !== 'active') {
          return json(res, 403, { error: 'Solo los afiliados activos pueden agendar citas.' });
        }
        const [doctor] = await doctorDirectory({ specialty, doctorId });
        if (!doctor) return json(res, 400, { error: 'El profesional seleccionado no atiende esa especialidad.' });
        if (doctor.id === patient.id) return json(res, 400, { error: 'No puedes agendar una cita contigo mismo.' });

        // Desde aquí todo es síncrono: validar e insertar ocurre sin que otra solicitud se intercale.
        const now = bogotaNow();
        if (date < now.date || date > addDays(now.date, MAX_BOOKING_DAYS)) {
          return json(res, 409, { error: `Solo se pueden agendar citas desde hoy y hasta ${MAX_BOOKING_DAYS} días.` });
        }
        const problem = checkSlot({ doctor, date, time, patientId: patient.id });
        if (problem) return json(res, 409, { error: problem });
        if (!isLab) {
          const pending = queryOne(
            `SELECT appointment_date AS date, appointment_time AS time FROM fact_appointments
             WHERE affiliate_id = ? AND specialty = ? AND status IN ('requested', 'confirmed', 'reschedule_required') AND appointment_date >= ?`,
            [patient.id, specialty, now.date],
          );
          if (pending) {
            return json(res, 409, {
              error: `Ya tienes una cita activa de ${specialty} el ${pending.date} a las ${pending.time}. Cancélala o reprográmala antes de agendar otra.`,
            });
          }
        }

        const id = newAppointmentId();
        try {
          execute(
            `INSERT INTO fact_appointments
               (appointment_id, affiliate_id, service_id, date_key, specialty, appointment_date, appointment_time, duration_minutes,
                status, doctor_id, modality, site, exam_code, reason, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?)`,
            [id, patient.id, serviceIdFor(specialty, isLab, date), date, specialty, date, time, doctor.slotMinutes, doctor.id, modality,
              modality === 'Teleconsulta' ? 'Teleconsulta (enlace por correo)' : doctor.site,
              exam?.code || null, reason || null, now.iso, now.iso],
          );
        } catch {
          return json(res, 409, { error: 'Ese cupo acaba de ser asignado a otro paciente. Elige otro horario.' });
        }
        if (exam) {
          try {
            const order = await callService('meds-labs', '/internal/lab-orders', {
              method: 'POST', body: { affiliateId: patient.id, appointmentId: id, examCode: exam.code, date, time, site: doctor.site },
            });
            execute('UPDATE fact_appointments SET lab_order_number = ? WHERE appointment_id = ?', [order.orderNumber, id]);
          } catch (error) {
            execute('DELETE FROM fact_appointments WHERE appointment_id = ?', [id]);
            throw error;
          }
        }
        const appointment = await findAppointment(id);
        publishEvent('appointment.created', { ...appointment, preparation: exam?.preparation || null });
        return json(res, 201, { appointment, preparation: exam?.preparation || null, event: 'appointment.created' });
      },
    },
    {
      // Reprogramar: el afiliado (o el call center) mueve su cita a otro cupo libre de la misma especialidad.
      method: 'POST',
      path: '/appointments/reschedule',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['affiliate', 'administrator']);
        if (!user) return;
        const data = await readJson(req);
        const current = appointmentRow(String(data.id || ''));
        if (!current) return json(res, 404, { error: 'Cita no encontrada.' });
        if (user.role === 'affiliate' && current.affiliateId !== user.sub) return json(res, 403, { error: 'Solo puedes reprogramar tus propias citas.' });
        if (!OPEN_STATUSES.includes(current.status)) return json(res, 409, { error: 'Solo se pueden reprogramar citas pendientes.' });
        if (!isValidDate(data.date) || !isValidTime(data.time)) return json(res, 400, { error: 'Selecciona el nuevo día y hora.' });
        const [doctor] = await doctorDirectory({ specialty: current.specialty, doctorId: data.doctorId });
        if (!doctor) return json(res, 400, { error: 'El profesional seleccionado no atiende esa especialidad.' });
        if (doctor.id === current.affiliateId) return json(res, 400, { error: 'No puedes agendar una cita contigo mismo.' });
        const now = bogotaNow();
        if (data.date > addDays(now.date, MAX_BOOKING_DAYS)) return json(res, 409, { error: `Solo se puede reprogramar hasta ${MAX_BOOKING_DAYS} días.` });
        const problem = checkSlot({ doctor, date: data.date, time: data.time, patientId: current.affiliateId, excludeId: current.id });
        if (problem) return json(res, 409, { error: problem });
        const note = `Reprogramada del ${current.date} ${current.time} al ${data.date} ${data.time}.`;
        serviceIdFor(current.specialty, Boolean(current.examCode), data.date);
        try {
          execute(
            `UPDATE fact_appointments SET doctor_id = ?, appointment_date = ?, date_key = ?, appointment_time = ?, duration_minutes = ?,
               site = ?, status = 'confirmed', change_note = ?, original_doctor_id = COALESCE(original_doctor_id, ?), updated_at = ?
             WHERE appointment_id = ?`,
            [doctor.id, data.date, data.date, data.time,
              doctor.slotMinutes, current.modality === 'Teleconsulta' ? current.site : doctor.site, note,
              current.doctorId !== doctor.id ? current.doctorId : null, now.iso, current.id],
          );
        } catch {
          return json(res, 409, { error: 'Ese cupo acaba de ser asignado a otro paciente. Elige otro horario.' });
        }
        if (current.examCode) {
          await tryCallService('meds-labs', '/internal/lab-orders/reschedule', {
            method: 'POST', body: { appointmentId: current.id, date: data.date, time: data.time, site: doctor.site },
          });
        }
        const appointment = await findAppointment(current.id);
        publishEvent('appointment.rescheduled', appointment);
        return json(res, 200, { appointment, event: 'appointment.rescheduled' });
      },
    },
    {
      // El médico atiende la cita: registra la evolución en la historia clínica, la cierra como atendida
      // y emite las órdenes que requieren autorización. La fórmula se emite en meds-labs.
      method: 'POST',
      path: '/appointments/attend',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['doctor']);
        if (!user) return;
        const data = await readJson(req);
        const appointment = appointmentRow(String(data.id || ''));
        if (!appointment) return json(res, 404, { error: 'Cita no encontrada.' });
        if (appointment.doctorId !== user.sub) return json(res, 403, { error: 'Esta cita no está en tu agenda.' });
        if (appointment.examCode) return json(res, 400, { error: 'Las citas de laboratorio se cierran con “Muestra tomada”.' });
        if (CLOSED_STATUSES.includes(appointment.status)) return json(res, 409, { error: 'La cita ya fue cerrada.' });
        if (appointment.status === 'reschedule_required') return json(res, 409, { error: 'La cita está pendiente de reprogramación.' });
        const now = bogotaNow();
        if (appointment.date > now.date) return json(res, 409, { error: 'Solo puedes atender la cita el día programado.' });
        const diagnosis = String(data.diagnosis || '').trim();
        if (diagnosis.length < 3) return json(res, 400, { error: 'Registra el diagnóstico o impresión diagnóstica.' });
        const chiefComplaint = String(data.chiefComplaint || appointment.reason || '').trim();
        if (chiefComplaint.length < 3) return json(res, 400, { error: 'Registra el motivo de consulta.' });
        const encounterError = validateEncounter(data);
        if (encounterError) return json(res, 400, { error: encounterError });
        const orders = (Array.isArray(data.authorizations) ? data.authorizations : [])
          .map(order => ({ service: findAuthorizationService(order.serviceCode), reason: String(order.reason || '').trim(), priority: order.priority }))
          .filter(order => order.service);
        if (orders.some(order => order.reason.length < 5)) return json(res, 400, { error: 'Cada orden necesita una justificación clínica.' });

        const vitals = data.vitals || {};
        const plan = String(data.plan ?? data.notes ?? '').trim().slice(0, 2000) || null;
        db.transaction(() => {
          execute(
            `UPDATE fact_appointments SET status = 'completed', diagnosis = ?, clinical_notes = ?, updated_at = ? WHERE appointment_id = ?`,
            [diagnosis.slice(0, 300), plan, now.iso, appointment.id],
          );
          execute(
            `INSERT INTO clinical_encounters (encounter_id, appointment_id, patient_id, doctor_id, doctor_name, specialty, encounter_date,
               chief_complaint, current_illness, blood_pressure, heart_rate, respiratory_rate, temperature, weight_kg, height_cm,
               oxygen_saturation, physical_exam, diagnosis, diagnosis_code, plan, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`HC-${appointment.id.replace('CITA-', '')}`, appointment.id, appointment.affiliateId, user.sub, user.name, appointment.specialty,
              appointment.date, chiefComplaint.slice(0, 500), String(data.currentIllness || '').trim().slice(0, 2000) || null,
              String(vitals.bloodPressure || '').trim() || null, num(vitals.heartRate), num(vitals.respiratoryRate), num(vitals.temperature),
              num(vitals.weightKg), num(vitals.heightCm), num(vitals.oxygenSaturation),
              String(data.physicalExam || '').trim().slice(0, 2000) || null, diagnosis.slice(0, 300),
              String(data.diagnosisCode || '').trim().toUpperCase() || null, plan, now.iso],
          );
          orders.forEach((order, index) => {
            order.id = `SOL-${now.date.slice(0, 4)}-${String(Date.now() + index).slice(-6)}`;
            execute(
              `INSERT INTO fact_authorizations
                 (authorization_id, affiliate_id, service_id, status, service_code, service_name, category,
                  ordered_by, order_reference, reason, priority, created_at, appointment_id)
               VALUES (?, ?, NULL, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [order.id, appointment.affiliateId, order.service.code,
                order.service.name, order.service.category, user.name, `ORD-${appointment.id.replace('CITA-', '')}-${index + 1}`,
                `${diagnosis}. ${order.reason}`.slice(0, 500), order.priority === 'prioritaria' ? 'prioritaria' : 'normal', now.iso, appointment.id],
            );
          });
        });
        const updated = await findAppointment(appointment.id);
        publishEvent('appointment.updated', updated);
        orders.forEach(order => publishEvent('authorization.created', { id: order.id, affiliateId: appointment.affiliateId, serviceName: order.service.name }));
        return json(res, 200, { appointment: updated, authorizations: orders.length });
      },
    },
    {
      method: 'PATCH',
      path: '/appointments',
      handler: async (req, res, url) => {
        const user = requireRole(req, res);
        if (!user) return;
        const data = await readJson(req);
        const appointmentId = url.searchParams.get('id') || data.id;
        const allowedStatuses = ['completed', 'no_show', 'cancelled'];
        if (!appointmentId || !allowedStatuses.includes(data.status)) {
          return json(res, 400, { error: 'Cita y estado válido son obligatorios.' });
        }
        const appointment = appointmentRow(appointmentId);
        if (!appointment) return json(res, 404, { error: 'Cita no encontrada.' });
        if (CLOSED_STATUSES.includes(appointment.status)) {
          return json(res, 409, { error: 'La cita ya fue cerrada y no se puede modificar.' });
        }
        const now = bogotaNow();
        if (user.role === 'affiliate') {
          if (appointment.affiliateId !== user.sub) return json(res, 403, { error: 'Solo puedes gestionar tus propias citas.' });
          if (data.status !== 'cancelled') return json(res, 403, { error: 'Como afiliado solo puedes cancelar tus citas.' });
          const startsAt = appointment.date === now.date ? Number(appointment.time.slice(0, 2)) * 60 + Number(appointment.time.slice(3)) : null;
          if (appointment.status !== 'reschedule_required' && (appointment.date < now.date || (startsAt != null && startsAt <= now.minutes))) {
            return json(res, 409, { error: 'No puedes cancelar una cita que ya pasó.' });
          }
        } else if (user.role === 'doctor') {
          if (appointment.doctorId !== user.sub) return json(res, 403, { error: 'Esta cita no está en tu agenda.' });
        }
        if (['completed', 'no_show'].includes(data.status)) {
          if (appointment.date > now.date) return json(res, 409, { error: 'No puedes registrar la atención de una cita futura.' });
          if (appointment.status === 'reschedule_required') return json(res, 409, { error: 'La cita está pendiente de reprogramación.' });
          if (data.status === 'completed' && !appointment.examCode) {
            return json(res, 400, { error: 'Para cerrar una consulta usa “Atender cita” y registra la historia clínica.' });
          }
        }
        let labDocumentId = null;
        if (appointment.examCode && data.status === 'completed') {
          labDocumentId = (await callService('meds-labs', '/internal/lab-orders/sample-taken', {
            method: 'POST', body: { appointmentId, takenBy: user.name },
          })).labDocumentId;
        }
        const cancelNote = data.status === 'cancelled' ? `Cancelada por ${ROLE_LABELS[user.role]?.toLowerCase() || user.role} (${user.name}).` : null;
        execute('UPDATE fact_appointments SET status = ?, change_note = COALESCE(?, change_note), updated_at = ? WHERE appointment_id = ?',
          [data.status, cancelNote, now.iso, appointmentId]);
        if (appointment.examCode && ['cancelled', 'no_show'].includes(data.status)) {
          await tryCallService('meds-labs', '/internal/lab-orders/cancel', { method: 'POST', body: { appointmentId } });
        }
        const updated = await findAppointment(appointmentId);
        publishEvent('appointment.updated', {
          ...updated,
          cancelledBy: data.status === 'cancelled' && user.sub !== appointment.affiliateId ? `${ROLE_LABELS[user.role]?.toLowerCase()} ${user.name}` : null,
        });
        return json(res, 200, { appointment: updated, labDocumentId, event: 'appointment.updated' });
      },
    },
    {
      method: 'GET',
      path: '/doctor/agenda',
      handler: async (req, res, url) => {
        const user = requireRole(req, res, ['doctor', 'administrator']);
        if (!user) return;
        const now = bogotaNow();
        const from = isValidDate(url.searchParams.get('date')) ? url.searchParams.get('date') : now.date;
        const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 1, 1), 31);
        const to = addDays(from, days - 1);
        const doctorId = user.role === 'doctor' ? user.sub : url.searchParams.get('doctorId');
        const params = [from, to];
        if (doctorId) params.push(doctorId);
        const rows = queryRows(
          `SELECT ${APPOINTMENT_COLUMNS} FROM fact_appointments
           WHERE appointment_date BETWEEN ? AND ? AND doctor_id IS NOT NULL ${doctorId ? 'AND doctor_id = ?' : ''}
             AND status <> 'reschedule_required'
           ORDER BY appointment_date, appointment_time`,
          params,
        );
        return json(res, 200, {
          from, to, today: now.date,
          doctor: doctorId ? await doctorProfile(doctorId) : null,
          absences: absencesOf(doctorId, from, to),
          items: await enrich(rows),
        });
      },
    },
    {
      method: 'GET',
      path: '/doctor/schedule',
      handler: async (req, res, url) => {
        const user = requireRole(req, res, ['doctor', 'administrator']);
        if (!user) return;
        const doctorId = user.role === 'doctor' ? user.sub : url.searchParams.get('doctorId');
        const doctor = doctorId ? await doctorProfile(doctorId) : null;
        if (!doctor) return json(res, 404, { error: 'Médico no encontrado.' });
        return json(res, 200, { doctor, specialties: SPECIALTIES, weekdays: WEEKDAYS });
      },
    },
    {
      method: 'PUT',
      path: '/doctor/schedule',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['doctor', 'administrator']);
        if (!user) return;
        const data = await readJson(req);
        const doctorId = user.role === 'doctor' ? user.sub : String(data.doctorId || '');
        const current = await doctorProfile(doctorId);
        const person = (await peopleById([doctorId])).get(doctorId);
        if (!current || !person?.roles.includes('doctor')) return json(res, 404, { error: 'La persona no tiene perfil de médico.' });

        // La especialidad y el estado los define el administrador; el médico gestiona su horario.
        const specialty = user.role === 'administrator' && data.specialty ? data.specialty : (current.specialty || 'Medicina general');
        const active = user.role === 'administrator' && data.active !== undefined ? (data.active ? 1 : 0) : (current.hasProfile ? current.active : 1);
        const slotMinutes = Number(data.slotMinutes || current.slotMinutes || 20);
        const site = String(data.site ?? current.site ?? '').trim() || null;
        const license = user.role === 'administrator' ? (String(data.license ?? current.license ?? '').trim() || null) : current.license;
        if (!SPECIALTIES.includes(specialty)) return json(res, 400, { error: 'Especialidad no válida.' });
        if (!Number.isInteger(slotMinutes) || slotMinutes < 10 || slotMinutes > 120) {
          return json(res, 400, { error: 'La duración de cada cita debe estar entre 10 y 120 minutos.' });
        }
        const blocks = (data.blocks || []).map(block => ({ weekday: Number(block.weekday), start: block.start, end: block.end }));
        const blockError = validateScheduleBlocks(blocks);
        if (blockError) return json(res, 400, { error: blockError });

        db.transaction(() => {
          execute(
            `INSERT INTO dim_doctors (doctor_id, specialty, license, site, slot_minutes, active) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(doctor_id) DO UPDATE SET specialty = excluded.specialty, license = excluded.license,
               site = excluded.site, slot_minutes = excluded.slot_minutes, active = excluded.active`,
            [doctorId, specialty, license, site, slotMinutes, active],
          );
          execute('DELETE FROM doctor_schedules WHERE doctor_id = ?', [doctorId]);
          blocks.forEach(block => execute(
            'INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)',
            [doctorId, block.weekday, block.start, block.end],
          ));
        });

        // Las citas ya asignadas se respetan; se informa cuáles quedaron fuera del nuevo horario.
        const updated = await doctorProfile(doctorId);
        const conflicts = queryRows(
          `SELECT appointment_id AS id, appointment_date AS date, appointment_time AS time
           FROM fact_appointments
           WHERE doctor_id = ? AND status IN ('requested', 'confirmed') AND appointment_date >= ?`,
          [doctorId, bogotaNow().date],
        ).filter(item => !item.time || !slotsOfDoctorOnDate(updated, updated.blocks, item.date).includes(item.time));
        return json(res, 200, { doctor: updated, conflicts });
      },
    },
    {
      method: 'GET',
      path: '/doctors/admin',
      handler: async (req, res) => {
        if (!requireRole(req, res, ['administrator'])) return;
        const people = await callService('users', '/internal/people?role=doctor');
        const items = await Promise.all(people.items.map(person => doctorProfile(person.id)));
        return json(res, 200, { items: items.filter(Boolean), specialties: SPECIALTIES, weekdays: WEEKDAYS, absenceTypes: ABSENCE_TYPES });
      },
    },

    // ---------- Incapacidades y ausencias del médico ----------
    {
      method: 'GET',
      path: '/doctor/absences',
      handler: async (req, res, url) => {
        const user = requireRole(req, res, ['doctor', 'administrator']);
        if (!user) return;
        const doctorId = user.role === 'doctor' ? user.sub : url.searchParams.get('doctorId');
        const today = bogotaNow().date;
        const items = absencesOf(doctorId, addDays(today, -90), addDays(today, 365));
        const people = await peopleById(items.map(item => item.doctorId));
        return json(res, 200, { items: items.map(item => ({ ...item, doctorName: people.get(item.doctorId)?.name })), types: ABSENCE_TYPES });
      },
    },
    {
      // Registra la incapacidad (o vacaciones/licencia) y reorganiza las citas afectadas:
      // 1) intenta reasignarlas a otro médico de la misma especialidad a la MISMA hora;
      // 2) si no hay nadie disponible, la cita queda "Por reprogramar" y el paciente elige un nuevo cupo.
      method: 'POST',
      path: '/doctor/absences',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['doctor', 'administrator']);
        if (!user) return;
        const data = await readJson(req);
        const doctorId = user.role === 'doctor' ? user.sub : String(data.doctorId || '');
        const doctor = await doctorProfile(doctorId);
        if (!doctor?.hasProfile) return json(res, 404, { error: 'Médico no encontrado.' });
        const type = String(data.type || '');
        const { startDate, endDate } = data;
        const today = bogotaNow().date;
        if (!ABSENCE_TYPES.includes(type)) return json(res, 400, { error: 'Selecciona el tipo de novedad.' });
        if (!isValidDate(startDate) || !isValidDate(endDate)) return json(res, 400, { error: 'Indica las fechas de inicio y fin.' });
        if (endDate < startDate) return json(res, 400, { error: 'La fecha final no puede ser anterior a la inicial.' });
        if (startDate < addDays(today, -1)) return json(res, 400, { error: 'La novedad no puede empezar en una fecha pasada.' });
        if (addDays(startDate, 180) < endDate) return json(res, 400, { error: 'Una novedad puede durar máximo 180 días.' });
        if (absencesOf(doctorId, startDate, endDate).length) return json(res, 409, { error: 'Ya hay una novedad registrada que se cruza con esas fechas.' });
        const notes = String(data.notes || '').trim().slice(0, 500) || null;

        const candidates = (await doctorDirectory({ specialty: doctor.specialty })).filter(item => item.id !== doctorId);
        const people = new Map();
        const absenceId = `AUS-${Date.now()}`;
        const now = bogotaNow();
        const reassigned = [];
        const toReschedule = [];
        db.transaction(() => {
          execute(
            `INSERT INTO doctor_absences (absence_id, doctor_id, type, start_date, end_date, notes, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [absenceId, doctorId, type, startDate, endDate, notes, user.name, now.iso],
          );
          const affected = queryRows(
            `SELECT ${APPOINTMENT_COLUMNS} FROM fact_appointments
             WHERE doctor_id = ? AND status IN ('requested', 'confirmed') AND appointment_date BETWEEN ? AND ?
             ORDER BY appointment_date, appointment_time`,
            [doctorId, startDate, endDate],
          );
          for (const appointment of affected) {
            const replacement = findReplacement(appointment, candidates);
            if (replacement) {
              execute(
                `UPDATE fact_appointments SET doctor_id = ?, site = ?, duration_minutes = ?, original_doctor_id = ?, change_note = ?, updated_at = ?
                 WHERE appointment_id = ?`,
                [replacement.id, appointment.modality === 'Teleconsulta' ? appointment.site : replacement.site, replacement.slotMinutes,
                  doctorId, `Reasignada de ${doctor.name} a ${replacement.name} por ${type}.`, now.iso, appointment.id],
              );
              reassigned.push({ ...appointment, doctorId: replacement.id, doctorName: replacement.name, site: replacement.site });
              people.set(replacement.id, replacement);
            } else {
              execute(
                `UPDATE fact_appointments SET status = 'reschedule_required', original_doctor_id = ?, change_note = ?, updated_at = ? WHERE appointment_id = ?`,
                [doctorId, `${doctor.name} no podrá atender por ${type}. Elige un nuevo horario.`, now.iso, appointment.id],
              );
              toReschedule.push(appointment);
            }
          }
        });

        for (const item of reassigned) {
          if (item.examCode) {
            await tryCallService('meds-labs', '/internal/lab-orders/reschedule', {
              method: 'POST', body: { appointmentId: item.id, date: item.date, time: item.time, site: item.site },
            });
          }
          publishEvent('appointment.reassigned', { ...item, previousDoctorName: doctor.name, absenceType: type });
        }
        toReschedule.forEach(item => publishEvent('appointment.reschedule_required', { ...item, previousDoctorName: doctor.name, absenceType: type }));
        publishEvent('doctor.absence.created', {
          id: absenceId, affiliateId: doctorId, type, startDate, endDate,
          affected: reassigned.length + toReschedule.length, reassigned: reassigned.length, toReschedule: toReschedule.length,
        });
        return json(res, 201, {
          absence: { id: absenceId, doctorId, type, startDate, endDate, notes },
          affected: reassigned.length + toReschedule.length,
          reassigned: reassigned.map(item => ({ id: item.id, date: item.date, time: item.time, doctorName: item.doctorName })),
          toReschedule: toReschedule.map(item => ({ id: item.id, date: item.date, time: item.time })),
        });
      },
    },
    {
      method: 'PATCH',
      path: '/doctor/absences',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['doctor', 'administrator']);
        if (!user) return;
        const data = await readJson(req);
        const absence = queryOne('SELECT doctor_id AS doctorId, cancelled_at AS cancelledAt FROM doctor_absences WHERE absence_id = ?', [String(data.id || '')]);
        if (!absence) return json(res, 404, { error: 'Novedad no encontrada.' });
        if (user.role === 'doctor' && absence.doctorId !== user.sub) return json(res, 403, { error: 'Solo puedes anular tus propias novedades.' });
        if (absence.cancelledAt) return json(res, 409, { error: 'La novedad ya estaba anulada.' });
        execute('UPDATE doctor_absences SET cancelled_at = ? WHERE absence_id = ?', [bogotaNow().iso, data.id]);
        return json(res, 200, { cancelled: true });
      },
    },

    // ---------- Historia clínica ----------
    {
      method: 'GET',
      path: '/clinical-history',
      handler: async (req, res, url) => {
        const user = requireRole(req, res, ['doctor']);
        if (!user) return;
        let patientId = url.searchParams.get('patientId');
        if (!patientId && url.searchParams.get('document')) patientId = (await personByDocument(url.searchParams.get('document')))?.id;
        if (!patientId) return json(res, 404, { error: 'Paciente no encontrado.' });
        if (!doctorTreatsPatient(user.sub, patientId)) {
          return json(res, 403, { error: 'Solo puedes consultar la historia clínica de pacientes que tienes o tuviste en tu agenda.' });
        }
        return json(res, 200, await clinicalHistory(patientId));
      },
    },
    {
      method: 'GET',
      path: '/clinical-history/mine',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['affiliate']);
        if (!user) return;
        return json(res, 200, await clinicalHistory(user.sub));
      },
    },
    {
      method: 'PUT',
      path: '/clinical-history/background',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['doctor']);
        if (!user) return;
        const data = await readJson(req);
        const patientId = String(data.patientId || '');
        if (!doctorTreatsPatient(user.sub, patientId)) return json(res, 403, { error: 'Solo puedes actualizar la historia de tus pacientes.' });
        if (data.bloodType && !BLOOD_TYPES.includes(data.bloodType)) return json(res, 400, { error: 'Grupo sanguíneo no válido.' });
        const text = value => String(value || '').trim().slice(0, 1000) || null;
        execute(
          `INSERT INTO clinical_backgrounds (patient_id, blood_type, allergies, personal_history, family_history, surgical_history,
             current_medications, habits, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(patient_id) DO UPDATE SET blood_type = excluded.blood_type, allergies = excluded.allergies,
             personal_history = excluded.personal_history, family_history = excluded.family_history,
             surgical_history = excluded.surgical_history, current_medications = excluded.current_medications,
             habits = excluded.habits, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
          [patientId, data.bloodType || null, text(data.allergies), text(data.personalHistory), text(data.familyHistory),
            text(data.surgicalHistory), text(data.currentMedications), text(data.habits), user.name, bogotaNow().iso],
        );
        return json(res, 200, await clinicalHistory(patientId));
      },
    },

    // ---------- Autorizaciones ----------
    {
      method: 'GET',
      path: '/authorizations/catalog',
      handler: (_req, res) => json(res, 200, { items: AUTHORIZATION_SERVICES }),
    },
    {
      // Consulta pública: documento del paciente + número de autorización o de solicitud.
      method: 'GET',
      path: '/authorizations',
      handler: async (req, res, url) => {
        const document = String(url.searchParams.get('document') || '').trim();
        const number = String(url.searchParams.get('number') || '').trim().toUpperCase();
        if (!document || !number) return json(res, 400, { error: 'Ingresa el documento y el número de autorización o de solicitud.' });
        const person = await personByDocument(document);
        if (!person) return json(res, 200, { items: [] });
        return json(res, 200, {
          items: await listAuthorizations('au.affiliate_id = ? AND (UPPER(au.auth_number) = ? OR UPPER(au.authorization_id) = ?)', [person.id, number, number]),
        });
      },
    },
    {
      method: 'GET',
      path: '/authorizations/mine',
      handler: async (req, res) => {
        const user = requireRole(req, res);
        if (!user) return;
        return json(res, 200, { items: await listAuthorizations('au.affiliate_id = ?', [user.sub]) });
      },
    },
    {
      method: 'GET',
      path: '/authorizations/queue',
      handler: async (req, res, url) => {
        if (!requireRole(req, res, ['administrator'])) return;
        const status = url.searchParams.get('status') || 'requested';
        return json(res, 200, { items: await listAuthorizations(status === 'all' ? '' : 'au.status = ?', status === 'all' ? [] : [status]) });
      },
    },
    {
      // El afiliado radica la solicitud con la orden de su médico tratante.
      method: 'POST',
      path: '/authorizations',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['affiliate', 'administrator']);
        if (!user) return;
        const data = await readJson(req);
        const patient = await resolvePatient(user, data);
        const service = findAuthorizationService(data.serviceCode);
        const orderedBy = String(data.orderedBy || '').trim();
        const orderReference = String(data.orderReference || '').trim();
        const reason = String(data.reason || '').trim();
        if (!service) return json(res, 400, { error: 'Selecciona el servicio que necesitas autorizar.' });
        if (!orderedBy || !orderReference) return json(res, 400, { error: 'Indica el médico que ordenó el servicio y el número de la orden médica.' });
        if (!/^[A-Za-z0-9-]{3,30}$/.test(orderReference)) return json(res, 400, { error: 'El número de la orden solo puede tener letras, números y guiones (3 a 30 caracteres).' });
        if (reason.length < 5) return json(res, 400, { error: 'Describe brevemente el motivo o diagnóstico de la orden.' });
        const duplicate = queryOne(
          "SELECT authorization_id AS id FROM fact_authorizations WHERE affiliate_id = ? AND service_code = ? AND status = 'requested'",
          [patient.id, service.code],
        );
        if (duplicate) return json(res, 409, { error: `Ya tienes una solicitud en trámite para ${service.name} (${duplicate.id}).` });

        const now = bogotaNow();
        const id = `SOL-${now.date.slice(0, 4)}-${String(Date.now()).slice(-6)}`;
        execute(
          `INSERT INTO fact_authorizations
             (authorization_id, affiliate_id, service_id, status, service_code, service_name, category,
              ordered_by, order_reference, reason, priority, created_at)
           VALUES (?, ?, NULL, 'requested', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, patient.id, service.code, service.name, service.category, orderedBy, orderReference,
            reason.slice(0, 500), data.priority === 'prioritaria' ? 'prioritaria' : 'normal', now.iso],
        );
        const [authorization] = await listAuthorizations('au.authorization_id = ?', [id]);
        publishEvent('authorization.created', authorization);
        return json(res, 201, { authorization, event: 'authorization.created' });
      },
    },
    {
      // El administrador (auditoría médica) aprueba o niega la solicitud.
      method: 'PATCH',
      path: '/authorizations',
      handler: async (req, res, url) => {
        const user = requireRole(req, res, ['administrator']);
        if (!user) return;
        const data = await readJson(req);
        const id = url.searchParams.get('id') || data.id;
        const current = queryOne('SELECT authorization_id AS id, status, service_code AS serviceCode FROM fact_authorizations WHERE authorization_id = ?', [id]);
        if (!current) return json(res, 404, { error: 'Solicitud no encontrada.' });
        if (current.status !== 'requested') return json(res, 409, { error: 'Esta solicitud ya fue resuelta.' });
        if (!['approved', 'denied'].includes(data.decision)) return json(res, 400, { error: 'Decisión no válida.' });
        const notes = String(data.notes || '').trim();
        if (data.decision === 'denied' && notes.length < 5) return json(res, 400, { error: 'Explica al afiliado el motivo de la negación.' });
        const now = bogotaNow();
        if (data.decision === 'approved') {
          const service = findAuthorizationService(current.serviceCode);
          execute(
            `UPDATE fact_authorizations SET status = 'approved', auth_number = ?, provider = ?, valid_until = ?,
               decided_by = ?, decided_at = ?, decision_notes = ? WHERE authorization_id = ?`,
            [`AUT-${now.date.slice(0, 4)}-${String(Math.floor(100000 + Math.random() * 900000))}`,
              String(data.provider || '').trim() || service?.provider || 'Red de prestadores Detritus',
              addDays(now.date, 90), user.name, now.iso, notes || null, id],
          );
        } else {
          execute(
            "UPDATE fact_authorizations SET status = 'denied', decided_by = ?, decided_at = ?, decision_notes = ? WHERE authorization_id = ?",
            [user.name, now.iso, notes, id],
          );
        }
        const [authorization] = await listAuthorizations('au.authorization_id = ?', [id]);
        publishEvent('authorization.updated', authorization);
        return json(res, 200, { authorization });
      },
    },

    // ---------- Rutas internas ----------
    {
      method: 'GET',
      path: '/internal/doctors',
      handler: (req, res, url) => {
        if (!requireInternal(req, res)) return;
        const doctor = queryOne(
          'SELECT doctor_id AS id, specialty, license, site, slot_minutes AS slotMinutes, active FROM dim_doctors WHERE doctor_id = ?',
          [url.searchParams.get('id')],
        );
        return json(res, 200, { doctor });
      },
    },
    {
      // users-service crea o actualiza la ficha profesional cuando asigna el perfil de médico.
      method: 'POST',
      path: '/internal/doctors',
      handler: async (req, res) => {
        if (!requireInternal(req, res)) return;
        const data = await readJson(req);
        const doctorId = String(data.doctorId || '');
        if (!doctorId) return json(res, 400, { error: 'doctorId es obligatorio.' });
        if (data.onlyIfMissing) {
          execute("INSERT OR IGNORE INTO dim_doctors (doctor_id, specialty, slot_minutes) VALUES (?, 'Medicina general', 20)", [doctorId]);
        } else {
          if (!SPECIALTIES.includes(data.specialty)) return json(res, 400, { error: 'Especialidad no válida.' });
          execute(
            `INSERT INTO dim_doctors (doctor_id, specialty, license, site, slot_minutes, active) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(doctor_id) DO UPDATE SET specialty = excluded.specialty, license = excluded.license,
               site = excluded.site, slot_minutes = excluded.slot_minutes, active = excluded.active`,
            [doctorId, data.specialty, data.license || null, data.site || null, Number(data.slotMinutes) || 20, data.active === false ? 0 : 1],
          );
        }
        return json(res, 200, { saved: true });
      },
    },
    {
      method: 'GET',
      path: '/internal/appointments',
      handler: (req, res, url) => {
        if (!requireInternal(req, res)) return;
        return json(res, 200, { appointment: appointmentRow(url.searchParams.get('id')) });
      },
    },
    {
      method: 'GET',
      path: '/internal/stats',
      handler: (req, res) => {
        if (!requireInternal(req, res)) return;
        return json(res, 200, queryOne(`
          SELECT (SELECT COUNT(*) FROM fact_appointments WHERE status IN ('requested', 'confirmed')) AS activeAppointments,
                 (SELECT COUNT(*) FROM fact_appointments WHERE status = 'reschedule_required') AS toReschedule,
                 (SELECT COUNT(*) FROM fact_authorizations WHERE status = 'requested') AS pendingAuthorizations`));
      },
    },
  ],
});
