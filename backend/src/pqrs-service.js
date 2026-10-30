import './env.js'; // primero: credenciales de backend/.env
import { startService, json, readJson } from './service.js';
import { publishEvent } from './broker.js';
import { createDatabase } from './database.js';
import { getAuthenticatedUser, requireRole } from './auth.js';
import { personByDocument, requireInternal } from './internal.js';
import { bogotaNow } from './clinical-catalog.js';
import { dueDateFor, PQRS_TYPES } from './pqrs-rules.js';
import { documentError, emailError, nameError, normalizePhone, phoneError } from './validators.js';

const db = await createDatabase('pqrs');
const { execute, queryOne, queryRows } = db;

const STATUSES = ['received', 'in_review', 'answered', 'closed'];
const PQRS_DOCUMENT_TYPES = ['CC', 'CE', 'TI', 'PA', 'PPT'];

function newFilingNumber(year) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `PQRS-${year}-${String(Math.floor(100000 + Math.random() * 900000))}`;
    if (!queryOne('SELECT 1 AS found FROM fact_pqrs WHERE pqrs_id = ?', [candidate])) return candidate;
  }
  return `PQRS-${year}-${Date.now().toString().slice(-6)}`;
}

const COLUMNS = `pqrs_id AS id, affiliate_id AS affiliateId, type, subject, description, requester_name AS requesterName,
  document_type AS documentType, document, email, phone, status, response, responded_by AS respondedBy,
  responded_at AS respondedAt, due_date AS dueDate, created_at AS createdAt, updated_at AS updatedAt`;

function withHistory(item) {
  return item && {
    ...item,
    history: queryRows(
      'SELECT status, note, changed_by AS changedBy, changed_at AS changedAt FROM pqrs_status_history WHERE pqrs_id = ? ORDER BY history_id',
      [item.id],
    ),
  };
}

const contactOf = item => ({ name: item.requesterName, email: item.email, phone: item.phone, whatsapp: true });

startService({
  name: 'pqrs-service',
  serviceKey: 'pqrs',
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'pqrs-service', status: 'ok', database: db.file }),
    },
    {
      // Consulta pública: radicado + documento (ambos obligatorios para proteger la información).
      method: 'GET',
      path: '/requests',
      handler: (req, res, url) => {
        const id = String(url.searchParams.get('id') || '').trim().toUpperCase();
        const document = String(url.searchParams.get('document') || '').trim();
        if (!id || !document) return json(res, 400, { error: 'Ingresa el número de radicado y el documento con el que radicaste.' });
        const item = queryOne(`SELECT ${COLUMNS} FROM fact_pqrs WHERE UPPER(pqrs_id) = ? AND document = ?`, [id, document]);
        return json(res, 200, { items: item ? [withHistory(item)] : [] });
      },
    },
    {
      method: 'GET',
      path: '/requests/mine',
      handler: (req, res) => {
        const user = requireRole(req, res);
        if (!user) return;
        const items = queryRows(
          `SELECT ${COLUMNS} FROM fact_pqrs WHERE affiliate_id = ? OR document = ? ORDER BY created_at DESC`,
          [user.sub, user.document || ''],
        ).map(withHistory);
        return json(res, 200, { items });
      },
    },
    {
      // Bandeja de atención al usuario (perfil administrador).
      method: 'GET',
      path: '/requests/queue',
      handler: (req, res, url) => {
        if (!requireRole(req, res, ['administrator'])) return;
        const status = url.searchParams.get('status') || 'open';
        const where = status === 'all' ? '' : status === 'open' ? "WHERE status IN ('received', 'in_review')" : 'WHERE status = ?';
        const items = queryRows(`SELECT ${COLUMNS} FROM fact_pqrs ${where} ORDER BY due_date, created_at`, STATUSES.includes(status) ? [status] : [])
          .map(withHistory);
        return json(res, 200, { items, today: bogotaNow().date });
      },
    },
    {
      method: 'POST',
      path: '/requests',
      handler: async (req, res) => {
        const data = await readJson(req);
        const viewer = getAuthenticatedUser(req);
        const type = String(data.type || '');
        const subject = String(data.subject || '').trim();
        const description = String(data.description || '').trim();
        const requesterName = String(data.name || '').trim();
        const documentType = PQRS_DOCUMENT_TYPES.includes(data.documentType) ? data.documentType : 'CC';
        const document = String(data.document || '').trim();
        const email = String(data.email || '').trim();
        const phone = normalizePhone(data.phone);
        const problem = (!PQRS_TYPES.includes(type) && 'Selecciona el tipo de solicitud.')
          || (subject.length < 5 && 'Escribe el asunto (mínimo 5 caracteres).')
          || nameError(requesterName)
          || documentError(document, documentType)
          || emailError(email)
          || phoneError(phone)
          || (description.length < 20 && 'Describe tu solicitud con al menos 20 caracteres.')
          || (description.length > 3000 && 'La descripción no puede superar 3000 caracteres.')
          || (!data.acceptDataPolicy && 'Debes autorizar el tratamiento de datos para radicar la solicitud.');
        if (problem) return json(res, 400, { error: problem });

        // Si quien radica está afiliado, la PQRS queda ligada a su cuenta (aparece en su portal).
        const person = viewer?.document === document
          ? { id: viewer.sub }
          : await personByDocument(document).catch(() => null);
        const now = bogotaNow();
        const request = {
          id: newFilingNumber(now.date.slice(0, 4)),
          affiliateId: person?.id || null,
          type, subject, description, requesterName, documentType, document, email, phone,
          status: 'received',
          dueDate: dueDateFor(type, now.date),
          createdAt: now.iso,
        };
        db.transaction(() => {
          execute(
            `INSERT INTO fact_pqrs (pqrs_id, affiliate_id, type, subject, description, requester_name, document_type, document,
               email, phone, status, due_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)`,
            [request.id, request.affiliateId, type, subject, description, requesterName, documentType, document, email, phone,
              request.dueDate, request.createdAt],
          );
          execute('INSERT INTO pqrs_status_history (pqrs_id, status, note, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)',
            [request.id, 'received', 'Solicitud radicada', requesterName, now.iso]);
        });
        const notification = await publishEvent('pqrs.created', { ...request, contact: contactOf(request) });
        return json(res, 201, { request, event: 'pqrs.created', notified: notification.via !== 'none' });
      },
    },
    {
      // El administrador cambia el estado y, al responder, escribe la respuesta que se envía al ciudadano.
      method: 'PATCH',
      path: '/requests',
      handler: async (req, res, url) => {
        const admin = requireRole(req, res, ['administrator']);
        if (!admin) return;
        const data = await readJson(req);
        const id = url.searchParams.get('id') || data.id;
        if (!id || !STATUSES.includes(data.status)) return json(res, 400, { error: 'Solicitud y estado válido son obligatorios' });
        const current = queryOne(`SELECT ${COLUMNS} FROM fact_pqrs WHERE pqrs_id = ?`, [id]);
        if (!current) return json(res, 404, { error: 'PQRS no encontrada' });
        if (current.status === 'closed') return json(res, 409, { error: 'La PQRS ya está cerrada.' });
        const response = String(data.response || '').trim();
        if (data.status === 'answered' && response.length < 20) return json(res, 400, { error: 'Escribe la respuesta al ciudadano (mínimo 20 caracteres).' });
        const now = bogotaNow();
        db.transaction(() => {
          execute(
            `UPDATE fact_pqrs SET status = ?, response = COALESCE(?, response), responded_by = CASE WHEN ? THEN ? ELSE responded_by END,
               responded_at = CASE WHEN ? THEN ? ELSE responded_at END, updated_at = ? WHERE pqrs_id = ?`,
            [data.status, response || null, response ? 1 : 0, admin.name, response ? 1 : 0, now.iso, now.iso, id],
          );
          execute('INSERT INTO pqrs_status_history (pqrs_id, status, note, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)',
            [id, data.status, response || String(data.note || '').trim() || null, admin.name, now.iso]);
        });
        const updated = withHistory(queryOne(`SELECT ${COLUMNS} FROM fact_pqrs WHERE pqrs_id = ?`, [id]));
        publishEvent('pqrs.updated', { ...updated, contact: contactOf(updated) });
        return json(res, 200, { request: updated, event: 'pqrs.updated' });
      },
    },
    {
      method: 'GET',
      path: '/internal/stats',
      handler: (req, res) => {
        if (!requireInternal(req, res)) return;
        return json(res, 200, queryOne("SELECT COUNT(*) AS openPqrs FROM fact_pqrs WHERE status IN ('received', 'in_review')"));
      },
    },
  ],
});
