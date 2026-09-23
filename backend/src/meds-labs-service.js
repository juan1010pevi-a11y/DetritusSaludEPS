import { startService, json, readJson } from './service.js';
import { execute, initDatabase, queryOne, queryRows, refreshDatabase } from './database.js';

await initDatabase();

function resolveAffiliate(data) {
  const value = String(data.document || data.affiliateId || '').trim();
  if (!value) return null;
  return queryOne(
    'SELECT affiliate_id AS id, name FROM dim_affiliates WHERE document = ? OR affiliate_id = ?',
    [value, value],
  );
}

startService({
  name: 'meds-labs-service',
  port: 4007,
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'meds-labs-service', status: 'ok', database: 'sqlite' }),
    },
    {
      method: 'GET',
      path: '/prescriptions',
      handler: (req, res, url) => {
        refreshDatabase();
        const value = url.searchParams.get('document') || url.searchParams.get('affiliateId');
        const prescriptionNumber = url.searchParams.get('prescriptionNumber');
        const affiliate = value
          ? queryOne('SELECT affiliate_id FROM dim_affiliates WHERE document = ? OR affiliate_id = ?', [value, value])
          : null;
        const filters = [];
        const params = [];
        if (affiliate) {
          filters.push('p.affiliate_id = ?');
          params.push(affiliate.affiliate_id);
        }
        if (prescriptionNumber) {
          filters.push('p.prescription_number = ?');
          params.push(prescriptionNumber);
        }
        const items = queryRows(
          `SELECT p.prescription_id AS id, p.affiliate_id AS affiliateId,
                  p.prescription_number AS prescriptionNumber, p.medication_name AS medication,
                  p.dosage, p.quantity, p.status, p.issued_at AS issuedAt,
                  p.delivery_point AS deliveryPoint, d.status AS dispensationStatus,
                  d.dispensed_at AS dispensedAt
           FROM fact_prescriptions p
           LEFT JOIN fact_medication_dispensations d ON d.prescription_id = p.prescription_id
           ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
           ORDER BY p.issued_at DESC`,
          params,
        );
        return json(res, 200, { items });
      },
    },
    {
      method: 'POST',
      path: '/prescriptions',
      handler: async (req, res) => {
        const data = await readJson(req);
        refreshDatabase();
        const affiliate = resolveAffiliate(data);
        if (!affiliate || !data.prescriptionNumber || !data.medication) {
          return json(res, 400, { error: 'Afiliado, número de fórmula y medicamento son obligatorios' });
        }
        const prescription = {
          id: `FAR-${Date.now()}`,
          affiliateId: affiliate.id,
          prescriptionNumber: data.prescriptionNumber,
          medication: data.medication,
          dosage: data.dosage || 'Según fórmula médica',
          quantity: Number(data.quantity) || 1,
          status: data.status || 'pending',
          issuedAt: data.issuedAt || new Date().toISOString().slice(0, 10),
          deliveryPoint: data.deliveryPoint || null,
        };
        execute(
          `INSERT INTO fact_prescriptions
             (prescription_id, affiliate_id, prescription_number, medication_name, dosage, quantity, status, issued_at, delivery_point)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [prescription.id, prescription.affiliateId, prescription.prescriptionNumber, prescription.medication,
            prescription.dosage, prescription.quantity, prescription.status, prescription.issuedAt, prescription.deliveryPoint],
        );
        return json(res, 201, { prescription });
      },
    },
    {
      method: 'GET',
      path: '/lab-results',
      handler: (req, res, url) => {
        refreshDatabase();
        const value = url.searchParams.get('document') || url.searchParams.get('affiliateId');
        const orderNumber = url.searchParams.get('orderNumber');
        const affiliate = value
          ? queryOne('SELECT affiliate_id FROM dim_affiliates WHERE document = ? OR affiliate_id = ?', [value, value])
          : null;
        const filters = [];
        const params = [];
        if (affiliate) {
          filters.push('affiliate_id = ?');
          params.push(affiliate.affiliate_id);
        }
        if (orderNumber) {
          filters.push('order_number = ?');
          params.push(orderNumber);
        }
        const items = queryRows(
          `SELECT lab_result_id AS id, affiliate_id AS affiliateId,
                  order_number AS orderNumber, test_name AS testName,
                  result, status, result_date AS resultDate
           FROM fact_lab_results
           ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
           ORDER BY result_date DESC`,
          params,
        );
        return json(res, 200, { items });
      },
    },
    {
      method: 'POST',
      path: '/lab-results',
      handler: async (req, res) => {
        const data = await readJson(req);
        refreshDatabase();
        const affiliate = resolveAffiliate(data);
        if (!affiliate || !data.orderNumber || !data.testName) {
          return json(res, 400, { error: 'Afiliado, número de orden y examen son obligatorios' });
        }
        const result = {
          id: `LAB-${Date.now()}`,
          affiliateId: affiliate.id,
          orderNumber: data.orderNumber,
          testName: data.testName,
          result: data.result || null,
          status: data.status || 'pending',
          resultDate: data.resultDate || null,
        };
        execute(
          `INSERT INTO fact_lab_results
             (lab_result_id, affiliate_id, order_number, test_name, result, status, result_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [result.id, result.affiliateId, result.orderNumber, result.testName, result.result, result.status, result.resultDate],
        );
        return json(res, 201, { result });
      },
    },
  ],
});