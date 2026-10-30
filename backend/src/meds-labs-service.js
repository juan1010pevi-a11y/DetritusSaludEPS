import './env.js'; // primero: credenciales de backend/.env
import { startService, json, readJson } from './service.js';
import { createDatabase } from './database.js';
import { publishEvent } from './broker.js';
import { getAuthenticatedUser, requireRole } from './auth.js';
import { callService, peopleById, personByDocument, requireInternal } from './internal.js';
import { addDays, bogotaNow, DELIVERY_POINTS, findLabExam, flagFor, LAB_SPECIALTY, MEDICATIONS } from './clinical-catalog.js';
import { labDocuments } from './lab-documents.js';

const db = await createDatabase('meds-labs', {
  seed(database) {
    database.execute(
      `INSERT OR IGNORE INTO fact_prescriptions
        (prescription_id, affiliate_id, prescription_number, formula_number, medication_name, dosage, quantity, status, issued_at,
         delivery_point, doctor_id, doctor_name, appointment_id, instructions, valid_until)
       VALUES ('FAR-001', 'user-001', 'FAR-2026-1234', 'FAR-2026-1234', 'Losartán 50 mg', '1 tableta cada 12 horas', 60, 'available',
         '2026-09-20', 'Droguería aliada Calle 80 - Av. Calle 80 # 70-10', 'staff-doctor', 'Médico demo', 'CITA-DEMO-0001',
         'Tomar con abundante agua.', '2026-12-20')`,
    );
    if (!database.queryOne("SELECT 1 AS ok FROM fact_lab_results WHERE lab_result_id = 'LAB-001'")) {
      const exam = findLabExam('HEMOGRAMA');
      database.execute(
        `INSERT INTO fact_lab_results (lab_result_id, affiliate_id, order_number, test_name, exam_code, result, status, result_date,
           sample_type, sample_taken_at, sample_taken_by, validated_by, validated_at, appointment_date, appointment_time, site)
         VALUES ('LAB-001', 'user-001', 'LAB-2026-123456', ?, 'HEMOGRAMA', 'Valores dentro de los rangos de referencia.', 'available',
           '2026-09-22', ?, '2026-09-21T07:10:00-05:00', 'Bact. Sandra Ruiz', 'Bact. Sandra Ruiz', '2026-09-22T10:30:00-05:00',
           '2026-09-21', '07:00', 'Laboratorio Sede Chapinero - Toma de muestras')`,
        [exam.name, exam.sample],
      );
      const values = ['14.2', '42', '6.8', '58', '32', '265'];
      exam.parameters.forEach((parameter, index) => database.execute(
        `INSERT INTO fact_lab_result_items (lab_result_id, position, parameter, value, unit, reference_range, flag)
         VALUES ('LAB-001', ?, ?, ?, ?, ?, ?)`,
        [index, parameter.name, values[index], parameter.unit, parameter.reference, flagFor(parameter, values[index])],
      ));
    }
  },
});
const { execute, queryOne, queryRows } = db;
const labs = labDocuments(db);

async function listPrescriptions(where, params) {
  const rows = queryRows(
    `SELECT p.prescription_id AS id, p.affiliate_id AS affiliateId,
            p.formula_number AS formulaNumber, p.prescription_number AS prescriptionNumber,
            p.medication_name AS medication, p.dosage, p.quantity, p.status, p.issued_at AS issuedAt,
            p.delivery_point AS deliveryPoint, p.doctor_name AS doctorName, p.instructions, p.valid_until AS validUntil,
            p.appointment_id AS appointmentId, p.updated_at AS updatedAt, d.dispensed_at AS dispensedAt
     FROM fact_prescriptions p
     LEFT JOIN fact_medication_dispensations d ON d.prescription_id = p.prescription_id
     ${where ? `WHERE ${where}` : ''}
     ORDER BY p.issued_at DESC, p.prescription_number`,
    params,
  );
  const people = await peopleById(rows.map(row => row.affiliateId));
  return rows.map(row => ({ ...row, patientName: people.get(row.affiliateId)?.name || 'Paciente', patientDocument: people.get(row.affiliateId)?.document || '' }));
}

/** Filtro por paciente: acepta documento o id (la persona vive en users-service). */
async function patientFilter(value, column) {
  if (!value) return null;
  const person = await personByDocument(value) || (await peopleById([value])).get(value);
  return person ? { sql: `${column} = ?`, param: person.id } : { sql: '1 = 0', param: null };
}

startService({
  name: 'meds-labs-service',
  serviceKey: 'meds-labs',
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'meds-labs-service', status: 'ok', database: db.file }),
    },
    {
      method: 'GET',
      path: '/catalog',
      handler: (_req, res) => json(res, 200, { medications: MEDICATIONS, deliveryPoints: DELIVERY_POINTS }),
    },
    {
      // Consulta pública: documento + número de fórmula (o de un ítem de la fórmula).
      method: 'GET',
      path: '/prescriptions',
      handler: async (req, res, url) => {
        const value = String(url.searchParams.get('document') || url.searchParams.get('affiliateId') || '').trim();
        const number = String(url.searchParams.get('prescriptionNumber') || '').trim().toUpperCase();
        const viewer = getAuthenticatedUser(req);
        const isStaff = viewer && ['doctor', 'administrator'].includes(viewer.role);
        if (!isStaff && (!value || !number)) return json(res, 400, { error: 'Ingresa el documento y el número de fórmula.' });
        const filters = [];
        const params = [];
        const patient = await patientFilter(value, 'p.affiliate_id');
        if (patient) { filters.push(patient.sql); if (patient.param) params.push(patient.param); }
        if (number) { filters.push('(UPPER(p.formula_number) = ? OR UPPER(p.prescription_number) = ?)'); params.push(number, number); }
        return json(res, 200, { items: await listPrescriptions(filters.join(' AND '), params) });
      },
    },
    {
      method: 'GET',
      path: '/prescriptions/mine',
      handler: async (req, res) => {
        const user = requireRole(req, res);
        if (!user) return;
        return json(res, 200, { items: await listPrescriptions('p.affiliate_id = ?', [user.sub]) });
      },
    },
    {
      // Bandeja de la farmacia (perfil administrador).
      method: 'GET',
      path: '/prescriptions/queue',
      handler: async (req, res, url) => {
        if (!requireRole(req, res, ['administrator'])) return;
        const status = url.searchParams.get('status') || 'pending';
        return json(res, 200, { items: await listPrescriptions(status === 'all' ? '' : 'p.status = ?', status === 'all' ? [] : [status]) });
      },
    },
    {
      // El médico formula a un paciente que atendió.
      method: 'POST',
      path: '/prescriptions',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['doctor']);
        if (!user) return;
        const data = await readJson(req);
        const { appointment } = await callService('healthcare', `/internal/appointments?id=${encodeURIComponent(String(data.appointmentId || ''))}`);
        if (!appointment) return json(res, 404, { error: 'Cita no encontrada.' });
        if (appointment.doctorId !== user.sub) return json(res, 403, { error: 'Solo puedes formular a pacientes de tu agenda.' });
        if (appointment.status !== 'completed') return json(res, 409, { error: 'Primero marca la cita como atendida.' });
        if (appointment.examCode) return json(res, 400, { error: 'Las citas de laboratorio no generan fórmula médica.' });
        const items = (Array.isArray(data.items) ? data.items : [])
          .map(item => ({
            medication: String(item.medication || '').trim().slice(0, 120),
            dosage: String(item.dosage || '').trim().slice(0, 200),
            quantity: Number(item.quantity),
          }))
          .filter(item => item.medication);
        if (!items.length) return json(res, 400, { error: 'Agrega al menos un medicamento.' });
        if (items.some(item => item.dosage.length < 5 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 360)) {
          return json(res, 400, { error: 'Cada medicamento necesita dosis/frecuencia y una cantidad entera entre 1 y 360.' });
        }
        const now = bogotaNow();
        const formulaNumber = `FAR-${now.date.slice(0, 4)}-${String(Math.floor(100000 + Math.random() * 900000))}`;
        const instructions = String(data.instructions || '').trim().slice(0, 500) || null;
        db.transaction(() => items.forEach((item, index) => {
          execute(
            `INSERT INTO fact_prescriptions
               (prescription_id, affiliate_id, prescription_number, medication_name, dosage, quantity, status, issued_at,
                delivery_point, formula_number, doctor_id, doctor_name, appointment_id, instructions, valid_until, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
            [`FAR-${Date.now()}-${index}`, appointment.affiliateId, `${formulaNumber}-${index + 1}`, item.medication,
              item.dosage, item.quantity, now.date, formulaNumber, user.sub, user.name, appointment.id, instructions,
              addDays(now.date, 30), now.iso],
          );
        }));
        publishEvent('prescription.created', { id: formulaNumber, affiliateId: appointment.affiliateId, items: items.length });
        return json(res, 201, { formulaNumber, items: await listPrescriptions('p.formula_number = ?', [formulaNumber]) });
      },
    },
    {
      // Farmacia: alistar (available) y entregar (delivered).
      method: 'PATCH',
      path: '/prescriptions',
      handler: async (req, res, url) => {
        const user = requireRole(req, res, ['administrator']);
        if (!user) return;
        const data = await readJson(req);
        const formulaNumber = url.searchParams.get('formula') || data.formulaNumber;
        const rows = queryRows('SELECT prescription_id AS id, affiliate_id AS affiliateId, status FROM fact_prescriptions WHERE formula_number = ?', [formulaNumber]);
        if (!rows.length) return json(res, 404, { error: 'Fórmula no encontrada.' });
        const now = bogotaNow();
        if (data.status === 'available') {
          if (!DELIVERY_POINTS.includes(data.deliveryPoint)) return json(res, 400, { error: 'Selecciona el punto de entrega.' });
          if (rows.some(row => row.status !== 'pending')) return json(res, 409, { error: 'La fórmula ya fue alistada.' });
          execute("UPDATE fact_prescriptions SET status = 'available', delivery_point = ?, updated_at = ? WHERE formula_number = ?",
            [data.deliveryPoint, now.iso, formulaNumber]);
        } else if (data.status === 'delivered') {
          if (rows.some(row => row.status !== 'available')) return json(res, 409, { error: 'Primero marca la fórmula como lista para entrega.' });
          db.transaction(() => {
            execute("UPDATE fact_prescriptions SET status = 'delivered', updated_at = ? WHERE formula_number = ?", [now.iso, formulaNumber]);
            rows.forEach(row => execute(
              `INSERT OR REPLACE INTO fact_medication_dispensations (dispensation_id, prescription_id, affiliate_id, status, dispensed_at, delivery_point)
               SELECT ?, prescription_id, affiliate_id, 'delivered', ?, delivery_point FROM fact_prescriptions WHERE prescription_id = ?`,
              [`DIS-${row.id}`, now.iso, row.id],
            ));
          });
        } else {
          return json(res, 400, { error: 'Estado no válido.' });
        }
        publishEvent('prescription.updated', { id: formulaNumber, affiliateId: rows[0].affiliateId, status: data.status, deliveryPoint: data.deliveryPoint });
        return json(res, 200, { items: await listPrescriptions('p.formula_number = ?', [formulaNumber]) });
      },
    },
    {
      // Consulta pública como en una EPS real: documento del paciente + número de orden.
      method: 'GET',
      path: '/lab-results',
      handler: async (req, res, url) => {
        const document = String(url.searchParams.get('document') || '').trim();
        const orderNumber = String(url.searchParams.get('orderNumber') || '').trim().toUpperCase();
        const viewer = getAuthenticatedUser(req);
        const isStaff = viewer && ['doctor', 'administrator'].includes(viewer.role);
        if (!isStaff && (!document || !orderNumber)) {
          return json(res, 400, { error: 'Ingresa el documento del paciente y el número de orden.' });
        }
        const filters = [];
        const params = [];
        const patient = await patientFilter(document, 'r.affiliate_id');
        if (patient) { filters.push(patient.sql); if (patient.param) params.push(patient.param); }
        if (orderNumber) { filters.push('UPPER(r.order_number) = ?'); params.push(orderNumber); }
        return json(res, 200, { items: await labs.listLabDocuments(filters.join(' AND '), params) });
      },
    },
    {
      method: 'GET',
      path: '/lab-results/mine',
      handler: async (req, res) => {
        const user = requireRole(req, res);
        if (!user) return;
        return json(res, 200, { items: await labs.listLabDocuments('r.affiliate_id = ?', [user.sub]) });
      },
    },
    {
      // Bandeja de trabajo del laboratorio: órdenes con muestra tomada pendientes de resultado.
      method: 'GET',
      path: '/lab-results/worklist',
      handler: async (req, res, url) => {
        const user = requireRole(req, res, ['doctor', 'administrator']);
        if (!user) return;
        const status = url.searchParams.get('status') || 'processing';
        const statuses = status === 'all' ? ['scheduled', 'processing', 'available'] : [status];
        const items = await labs.listLabDocuments(`r.status IN (${statuses.map(() => '?').join(',')})`, statuses, { includeDraftValues: true });
        return json(res, 200, { items });
      },
    },
    {
      // El laboratorio diligencia el documento de resultados y, si lo indica, lo valida y publica.
      method: 'PUT',
      path: '/lab-results/document',
      handler: async (req, res) => {
        const user = requireRole(req, res, ['doctor', 'administrator']);
        if (!user) return;
        const data = await readJson(req);
        if (user.role === 'doctor') {
          const { doctor } = await callService('healthcare', `/internal/doctors?id=${encodeURIComponent(user.sub)}`);
          if (doctor?.specialty !== LAB_SPECIALTY) return json(res, 403, { error: 'Solo el personal de laboratorio puede registrar resultados.' });
        }
        const order = queryOne(
          `SELECT lab_result_id AS id, affiliate_id AS affiliateId, exam_code AS examCode, status, test_name AS testName, order_number AS orderNumber
           FROM fact_lab_results WHERE order_number = ?`,
          [String(data.orderNumber || '')],
        );
        if (!order) return json(res, 404, { error: 'Orden de laboratorio no encontrada.' });
        if (order.status === 'scheduled') return json(res, 409, { error: 'Primero registra la toma de muestra (marcar la cita como atendida).' });
        if (order.status === 'cancelled') return json(res, 409, { error: 'La orden fue cancelada.' });
        if (order.status === 'available') return json(res, 409, { error: 'El resultado ya fue validado y publicado.' });
        const exam = findLabExam(order.examCode);
        const values = Array.isArray(data.items) ? data.items : [];
        const items = queryRows('SELECT item_id AS id, position FROM fact_lab_result_items WHERE lab_result_id = ? ORDER BY position', [order.id]);
        for (const item of items) {
          const incoming = values.find(value => Number(value.id) === item.id);
          if (!incoming) continue;
          const value = String(incoming.value ?? '').trim().slice(0, 60);
          const parameter = exam?.parameters[item.position] || {};
          // Los parámetros con rango numérico solo aceptan números.
          if (value && (parameter.low != null || parameter.high != null) && !/^\d+([.,]\d+)?$/.test(value)) {
            return json(res, 400, { error: `${parameter.name}: escribe solo el valor numérico (ej. 14.2).` });
          }
          execute('UPDATE fact_lab_result_items SET value = ?, flag = ? WHERE item_id = ?', [value || null, flagFor(parameter, value), item.id]);
        }
        const observations = String(data.observations || '').trim().slice(0, 1000) || null;
        execute('UPDATE fact_lab_results SET observations = ? WHERE lab_result_id = ?', [observations, order.id]);

        if (data.publish) {
          const missing = queryOne(
            "SELECT COUNT(*) AS total FROM fact_lab_result_items WHERE lab_result_id = ? AND (value IS NULL OR value = '')",
            [order.id],
          );
          if (missing.total > 0) return json(res, 400, { error: `Faltan ${missing.total} valores por registrar antes de validar.` });
          const altered = queryOne(
            "SELECT COUNT(*) AS total FROM fact_lab_result_items WHERE lab_result_id = ? AND flag IN ('H', 'L')",
            [order.id],
          ).total;
          const now = bogotaNow();
          execute(
            `UPDATE fact_lab_results SET status = 'available', validated_by = ?, validated_at = ?, result_date = ?, result = ?
             WHERE lab_result_id = ?`,
            [user.name, now.iso, now.date,
              altered ? `${altered} valor(es) fuera del rango de referencia. Consulta con tu médico tratante.` : 'Valores dentro de los rangos de referencia.',
              order.id],
          );
          publishEvent('lab-result.available', { id: order.id, affiliateId: order.affiliateId, orderNumber: order.orderNumber, testName: order.testName });
        }
        const [document] = await labs.listLabDocuments('r.lab_result_id = ?', [order.id], { includeDraftValues: true });
        return json(res, 200, { document });
      },
    },

    // ---------- Rutas internas (healthcare-service) ----------
    {
      method: 'POST',
      path: '/internal/lab-orders',
      handler: async (req, res) => {
        if (!requireInternal(req, res)) return;
        const data = await readJson(req);
        const exam = findLabExam(data.examCode);
        if (!exam) return json(res, 400, { error: 'Examen no válido.' });
        const orderNumber = labs.createLabOrder({ ...data, exam });
        return json(res, 201, { orderNumber });
      },
    },
    {
      method: 'POST',
      path: '/internal/lab-orders/sample-taken',
      handler: async (req, res) => {
        if (!requireInternal(req, res)) return;
        const { appointmentId, takenBy } = await readJson(req);
        return json(res, 200, { labDocumentId: labs.createLabDocumentForAppointment(appointmentId, takenBy) });
      },
    },
    {
      method: 'POST',
      path: '/internal/lab-orders/cancel',
      handler: async (req, res) => {
        if (!requireInternal(req, res)) return;
        const { appointmentId } = await readJson(req);
        labs.cancelLabOrderForAppointment(appointmentId);
        return json(res, 200, { cancelled: true });
      },
    },
    {
      method: 'POST',
      path: '/internal/lab-orders/reschedule',
      handler: async (req, res) => {
        if (!requireInternal(req, res)) return;
        const { appointmentId, date, time, site } = await readJson(req);
        execute('UPDATE fact_lab_results SET appointment_date = ?, appointment_time = ?, site = COALESCE(?, site) WHERE appointment_id = ?',
          [date, time, site || null, appointmentId]);
        return json(res, 200, { updated: true });
      },
    },
    {
      // Para la agenda: fórmulas y estado del laboratorio de cada cita.
      method: 'GET',
      path: '/internal/appointment-links',
      handler: (req, res, url) => {
        if (!requireInternal(req, res)) return;
        const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
        const items = {};
        if (ids.length) {
          const marks = ids.map(() => '?').join(',');
          queryRows(`SELECT appointment_id AS id, GROUP_CONCAT(DISTINCT formula_number) AS formulas FROM fact_prescriptions WHERE appointment_id IN (${marks}) GROUP BY appointment_id`, ids)
            .forEach(row => { items[row.id] = { ...items[row.id], formulas: row.formulas }; });
          queryRows(`SELECT appointment_id AS id, status FROM fact_lab_results WHERE appointment_id IN (${marks})`, ids)
            .forEach(row => { items[row.id] = { ...items[row.id], labStatus: row.status }; });
        }
        return json(res, 200, { items });
      },
    },
    {
      // Para la historia clínica: medicamentos formulados y resultados de laboratorio del paciente.
      method: 'GET',
      path: '/internal/patient-summary',
      handler: async (req, res, url) => {
        if (!requireInternal(req, res)) return;
        const affiliateId = url.searchParams.get('affiliateId');
        const prescriptions = queryRows(
          `SELECT formula_number AS formulaNumber, medication_name AS medication, dosage, quantity, status, issued_at AS issuedAt,
                  doctor_name AS doctorName, appointment_id AS appointmentId
           FROM fact_prescriptions WHERE affiliate_id = ? ORDER BY issued_at DESC`,
          [affiliateId],
        );
        const labResults = await labs.listLabDocuments('r.affiliate_id = ?', [affiliateId]);
        return json(res, 200, { prescriptions, labs: labResults });
      },
    },
    {
      method: 'GET',
      path: '/internal/stats',
      handler: (req, res) => {
        if (!requireInternal(req, res)) return;
        return json(res, 200, queryOne(`
          SELECT (SELECT COUNT(*) FROM fact_lab_results WHERE status IN ('scheduled', 'processing')) AS pendingLabs,
                 (SELECT COUNT(DISTINCT formula_number) FROM fact_prescriptions WHERE status = 'pending') AS pendingFormulas`));
      },
    },
  ],
});
