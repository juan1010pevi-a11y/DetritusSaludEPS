import { bogotaNow, findLabExam } from './clinical-catalog.js';
import { peopleById } from './internal.js';

/**
 * Órdenes y documentos de resultados de laboratorio. Trabaja sobre la base de
 * meds-labs-service (se recibe `db`); los nombres de los pacientes se piden a users-service.
 */
export function labDocuments(db) {
  const { execute, queryOne, queryRows } = db;

  function newLabOrderNumber() {
    const year = bogotaNow().date.slice(0, 4);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `LAB-${year}-${String(Math.floor(100000 + Math.random() * 900000))}`;
      if (!queryOne('SELECT 1 AS found FROM fact_lab_results WHERE order_number = ?', [candidate])) return candidate;
    }
    return `LAB-${year}-${Date.now().toString().slice(-6)}`;
  }

  /** Al agendar un examen se crea la orden en estado "scheduled" (muestra pendiente). */
  function createLabOrder({ affiliateId, appointmentId, exam, date, time, site }) {
    const orderNumber = newLabOrderNumber();
    execute(
      `INSERT INTO fact_lab_results
         (lab_result_id, affiliate_id, order_number, test_name, result, status, result_date, appointment_id, exam_code, sample_type,
          appointment_date, appointment_time, site)
       VALUES (?, ?, ?, ?, NULL, 'scheduled', NULL, ?, ?, ?, ?, ?, ?)`,
      [`LAB-${Date.now()}${Math.floor(Math.random() * 90 + 10)}`, affiliateId, orderNumber, exam.name, appointmentId, exam.code, exam.sample,
        date || null, time || null, site || null],
    );
    return orderNumber;
  }

  /**
   * Cuando el paciente asiste y se le toma la muestra, se crea el documento de
   * resultados con todos los parámetros del examen vacíos, listo para que el
   * laboratorio registre los valores.
   */
  function createLabDocumentForAppointment(appointmentId, takenBy) {
    const order = queryOne(
      'SELECT lab_result_id AS id, exam_code AS examCode, status FROM fact_lab_results WHERE appointment_id = ?',
      [appointmentId],
    );
    if (!order) return null;
    const exam = findLabExam(order.examCode);
    if (!exam) return null;
    db.transaction(() => {
      if (order.status === 'scheduled' || order.status === 'cancelled') {
        execute(
          "UPDATE fact_lab_results SET status = 'processing', sample_taken_at = ?, sample_taken_by = ? WHERE lab_result_id = ?",
          [bogotaNow().iso, takenBy, order.id],
        );
      }
      exam.parameters.forEach((parameter, index) => {
        execute(
          `INSERT OR IGNORE INTO fact_lab_result_items (lab_result_id, position, parameter, value, unit, reference_range, flag)
           VALUES (?, ?, ?, NULL, ?, ?, '')`,
          [order.id, index, parameter.name, parameter.unit, parameter.reference],
        );
      });
    });
    return order.id;
  }

  function cancelLabOrderForAppointment(appointmentId) {
    execute("UPDATE fact_lab_results SET status = 'cancelled' WHERE appointment_id = ? AND status = 'scheduled'", [appointmentId]);
  }

  const DOCUMENT_COLUMNS = `
    r.lab_result_id AS id, r.affiliate_id AS affiliateId, r.order_number AS orderNumber,
    r.test_name AS testName, r.exam_code AS examCode, r.result, r.status, r.result_date AS resultDate,
    r.sample_type AS sampleType, r.sample_taken_at AS sampleTakenAt, r.sample_taken_by AS sampleTakenBy,
    r.validated_by AS validatedBy, r.validated_at AS validatedAt, r.observations,
    r.appointment_id AS appointmentId, r.appointment_date AS appointmentDate, r.appointment_time AS appointmentTime, r.site
  `;

  /**
   * Devuelve las órdenes con su documento de resultados. Los valores solo se
   * entregan al afiliado cuando el resultado fue validado (status = available),
   * salvo que se pida explícitamente para el personal del laboratorio.
   */
  async function listLabDocuments(where, params, { includeDraftValues = false } = {}) {
    const documents = queryRows(
      `SELECT ${DOCUMENT_COLUMNS} FROM fact_lab_results r
       ${where ? `WHERE ${where}` : ''}
       ORDER BY COALESCE(r.validated_at, r.sample_taken_at, r.appointment_date, r.result_date) DESC`,
      params,
    );
    const people = await peopleById(documents.map(document => document.affiliateId));
    return documents.map(document => {
      const visible = includeDraftValues || document.status === 'available';
      const items = visible
        ? queryRows(
          `SELECT item_id AS id, position, parameter, value, unit, reference_range AS reference, flag
           FROM fact_lab_result_items WHERE lab_result_id = ? ORDER BY position`,
          [document.id],
        )
        : [];
      const patient = people.get(document.affiliateId);
      return { ...document, patientName: patient?.name || 'Paciente', patientDocument: patient?.document || '', items };
    });
  }

  return { createLabOrder, createLabDocumentForAppointment, cancelLabOrderForAppointment, listLabDocuments };
}
