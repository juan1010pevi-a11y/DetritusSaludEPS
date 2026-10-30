import './env.js'; // primero: credenciales de backend/.env
import { startService, json, readJson, HttpError } from './service.js';
import { createDatabase } from './database.js';
import { hashPassword, verifyPassword } from './security.js';
import { addDays, bogotaNow, DOCUMENT_TYPES, isValidDate, RELATIONSHIPS, SPECIALTIES } from './clinical-catalog.js';
import { getAuthenticatedUser, requireRole } from './auth.js';
import { callService, requireInternal, tryCallService } from './internal.js';
import { publishEvent } from './broker.js';
import { DEMO_PEOPLE } from './seed-data.js';
import { documentError, emailError, maskContact, nameError, normalizePhone, passwordError, phoneError } from './validators.js';

const availableRoles = ['affiliate', 'doctor', 'administrator'];
const ROLE_PRIORITY = ['affiliate', 'doctor', 'administrator'];

const db = await createDatabase('users', {
  seed(database) {
    database.execute("INSERT OR IGNORE INTO dim_plans (name, regime) VALUES ('Régimen contributivo', 'contributivo')");
    database.execute("INSERT OR IGNORE INTO dim_plans (name, regime) VALUES ('Régimen subsidiado', 'subsidiado')");
    const plan = database.queryOne("SELECT plan_id FROM dim_plans WHERE name = 'Régimen contributivo'").plan_id;
    for (const person of DEMO_PEOPLE) {
      if (database.queryOne('SELECT 1 AS ok FROM dim_affiliates WHERE affiliate_id = ?', [person.id])) continue;
      database.execute(
        `INSERT INTO dim_affiliates (affiliate_id, name, document, password, email, phone, whatsapp_opt_in, role, status, plan_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [person.id, person.name, person.document, hashPassword(person.password), person.email, person.phone,
          person.whatsapp || 0, person.roles[0], plan],
      );
      person.roles.forEach(role => database.execute('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)', [person.id, role]));
    }
  },
});
const { queryOne, queryRows, execute } = db;

function requireAdministrator(req, res) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'administrator') {
    json(res, 403, { error: 'Se requiere un perfil administrador' });
    return null;
  }
  return user;
}

const rolesOf = userId => queryRows('SELECT role FROM user_roles WHERE user_id = ?', [userId])
  .map(row => row.role)
  .sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b));

const PERSON_COLUMNS = `a.affiliate_id AS id, a.name, a.document, a.document_type AS documentType, a.email, a.phone,
  a.whatsapp_opt_in AS whatsappOptIn, a.status, p.name AS plan, a.city, a.address`;

/** Datos públicos de una persona para otros microservicios (nunca incluye la contraseña). */
function toPerson(row) {
  return row && { ...row, whatsappOptIn: Boolean(row.whatsappOptIn), roles: rolesOf(row.id) };
}

const SISBEN_GROUPS = [
  ...Array.from({ length: 5 }, (_, i) => `A${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `B${i + 1}`),
  ...Array.from({ length: 18 }, (_, i) => `C${i + 1}`),
];
const CONTRIBUTIVE_TYPES = ['dependiente', 'independiente', 'pensionado'];

function ageOn(birthDate, today) {
  const [y, m, d] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

const clean = value => String(value ?? '').trim();

/** Valida el Formulario Único de Afiliación. Devuelve un mensaje de error o null. */
function validateAffiliation(data, today) {
  if (!['contributivo', 'subsidiado'].includes(data.regime)) return 'Selecciona el régimen de afiliación.';
  if (data.regime === 'contributivo' && !CONTRIBUTIVE_TYPES.includes(data.affiliateType)) return 'Selecciona si eres trabajador dependiente, independiente o pensionado.';
  if (!['CC', 'CE', 'PA', 'PPT'].includes(data.documentType)) return 'El cotizante o cabeza de familia debe identificarse con CC, CE, pasaporte o PPT.';
  const docError = documentError(clean(data.document), data.documentType);
  if (docError) return docError;
  if (!clean(data.firstName) || !clean(data.firstSurname)) return 'Primer nombre y primer apellido son obligatorios.';
  if (nameError([data.firstName, data.secondName, data.firstSurname, data.secondSurname].map(clean).join(' '))) return 'Los nombres y apellidos solo pueden tener letras.';
  if (!isValidDate(data.birthDate) || data.birthDate > today) return 'La fecha de nacimiento no es válida.';
  if (ageOn(data.birthDate, today) < 18) return 'El titular debe ser mayor de edad. Los menores se afilian como beneficiarios de un adulto.';
  if (ageOn(data.birthDate, today) > 120) return 'La fecha de nacimiento no es válida.';
  if (!['F', 'M'].includes(data.sex)) return 'Selecciona el sexo.';
  if (!clean(data.department) || !clean(data.city) || clean(data.address).length < 5) return 'Completa departamento, municipio y dirección de residencia.';
  if (clean(data.landline) && !/^\d{7,10}$/.test(clean(data.landline))) return 'El teléfono fijo debe tener entre 7 y 10 dígitos.';
  const phoneProblem = phoneError(data.phone);
  if (phoneProblem) return phoneProblem;
  const emailProblem = emailError(data.email);
  if (emailProblem) return emailProblem;
  if (!clean(data.primaryIps)) return 'Selecciona tu IPS primaria.';
  if (data.regime === 'contributivo') {
    const incomeText = String(data.baseIncome ?? '').replace(/[.\s$]/g, '');
    if (incomeText && !/^\d+$/.test(incomeText)) return 'El ingreso debe escribirse solo con números.';
    const income = Number(incomeText);
    if (data.affiliateType === 'dependiente') {
      if (!clean(data.employerName) || !/^\d{9,10}$/.test(clean(data.employerNit).replace(/\D/g, ''))) return 'Indica la razón social y el NIT (9 o 10 dígitos) de tu empleador.';
      if (!income) return 'Indica tu salario (ingreso base de cotización).';
    }
    if (data.affiliateType === 'independiente') {
      if (!clean(data.economicActivity)) return 'Indica tu actividad económica.';
      if (!income) return 'Indica tu ingreso mensual (se cotiza sobre el 40%).';
    }
    if (data.affiliateType === 'pensionado' && !clean(data.pensionFund)) return 'Indica la entidad que te paga la pensión.';
  } else if (!SISBEN_GROUPS.includes(clean(data.sisbenGroup).toUpperCase())) {
    return 'Para el régimen subsidiado indica tu grupo del SISBÉN IV (A1 a C18).';
  }

  const beneficiaries = Array.isArray(data.beneficiaries) ? data.beneficiaries : [];
  if (beneficiaries.length > 6) return 'Puedes inscribir máximo 6 beneficiarios en línea.';
  const seen = new Set([`${data.documentType}-${clean(data.document)}`]);
  let spouses = 0;
  for (const [index, person] of beneficiaries.entries()) {
    const label = `Beneficiario ${index + 1}`;
    if (!DOCUMENT_TYPES.includes(person.documentType)) return `${label}: selecciona el tipo de documento.`;
    const beneficiaryDocError = documentError(clean(person.document), person.documentType);
    if (beneficiaryDocError) return `${label}: ${beneficiaryDocError}`;
    if (nameError(person.name) || clean(person.name).length < 5) return `${label}: escribe nombres y apellidos completos (solo letras).`;
    if (!RELATIONSHIPS.includes(person.relationship)) return `${label}: selecciona el parentesco.`;
    if (!isValidDate(person.birthDate) || person.birthDate > today) return `${label}: fecha de nacimiento no válida.`;
    const key = `${person.documentType}-${clean(person.document)}`;
    if (seen.has(key)) return `${label}: el documento está repetido.`;
    seen.add(key);
    const age = ageOn(person.birthDate, today);
    if (person.relationship.startsWith('Cónyuge')) {
      spouses += 1;
      if (age < 18) return `${label}: el cónyuge debe ser mayor de edad.`;
    }
    if (person.relationship.startsWith('Hijo') && age >= 25) return `${label}: los hijos son beneficiarios hasta los 25 años.`;
    if (age < 18 && ['CC', 'CE'].includes(person.documentType)) return `${label}: un menor de edad se identifica con TI o RC.`;
  }
  if (spouses > 1) return 'Solo puedes inscribir un cónyuge o compañero(a) permanente.';
  const hasParents = beneficiaries.some(person => person.relationship === 'Padre o madre');
  if (hasParents && beneficiaries.some(person => person.relationship !== 'Padre o madre')) {
    return 'Los padres solo pueden ser beneficiarios cuando no hay cónyuge ni hijos inscritos.';
  }
  if (!data.acceptDataPolicy || !data.acceptTruthfulness || !data.declareNoOtherEps) {
    return 'Debes aceptar el tratamiento de datos y las declaraciones para radicar la afiliación.';
  }
  const passwordProblem = passwordError(data.password);
  if (passwordProblem) return passwordProblem;
  if (data.password !== data.passwordConfirm) return 'Las contraseñas no coinciden.';
  return null;
}

function planId(name, regime) {
  execute('INSERT OR IGNORE INTO dim_plans (name, regime) VALUES (?, ?)', [name, regime]);
  return queryOne('SELECT plan_id FROM dim_plans WHERE name = ?', [name]).plan_id;
}

startService({
  name: 'users-service',
  serviceKey: 'users',
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: (_req, res) => json(res, 200, { service: 'users-service', status: 'ok', database: db.file }),
    },
    {
      method: 'GET',
      path: '/affiliates/demo',
      handler: (_req, res) => {
        const affiliate = queryOne(
          `SELECT a.affiliate_id AS id, a.document, a.status, p.name AS plan
           FROM dim_affiliates a JOIN dim_plans p ON p.plan_id = a.plan_id WHERE a.affiliate_id = ?`,
          ['user-001'],
        );
        if (!affiliate) return json(res, 404, { error: 'Afiliado no encontrado' });
        return json(res, 200, affiliate);
      },
    },
    {
      method: 'GET',
      path: '/profile',
      handler: (req, res, url) => {
        const value = url.searchParams.get('affiliateId') || url.searchParams.get('document');
        const profile = queryOne(
          `SELECT a.affiliate_id AS id, a.name, a.document, a.role, a.status, p.name AS plan, a.created_at AS createdAt,
                  a.document_type AS documentType, a.affiliate_type AS affiliateType, a.city, a.department,
                  a.primary_ips AS primaryIps, a.filing_number AS filingNumber, a.effective_date AS effectiveDate,
                  a.sisben_group AS sisbenGroup, a.email, a.phone, a.address, a.whatsapp_opt_in AS whatsappOptIn
           FROM dim_affiliates a JOIN dim_plans p ON p.plan_id = a.plan_id
           WHERE a.affiliate_id = ? OR a.document = ?`,
          [value, value],
        );
        if (!profile) return json(res, 404, { error: 'Afiliado no encontrado' });
        profile.roles = rolesOf(profile.id).join(',');
        profile.beneficiaries = queryRows(
          `SELECT document_type AS documentType, document, name, relationship, birth_date AS birthDate
           FROM dim_beneficiaries WHERE affiliate_id = ? ORDER BY beneficiary_id`,
          [profile.id],
        );
        // Solo el dueño de la cuenta ve sus datos de contacto completos.
        const viewer = getAuthenticatedUser(req);
        if (viewer?.sub !== profile.id) {
          profile.email = maskContact(profile.email);
          profile.phone = maskContact(profile.phone);
          profile.address = null;
        }
        profile.whatsappOptIn = Boolean(profile.whatsappOptIn);
        return json(res, 200, profile);
      },
    },
    {
      // El afiliado actualiza sus propios datos de contacto (con sesión iniciada).
      method: 'PATCH',
      path: '/profile',
      handler: async (req, res) => {
        const user = requireRole(req, res);
        if (!user) return;
        const data = await readJson(req);
        const current = queryOne('SELECT affiliate_id AS id, name, email, phone, address, whatsapp_opt_in AS whatsapp FROM dim_affiliates WHERE affiliate_id = ?', [user.sub]);
        if (!current) return json(res, 404, { error: 'Afiliado no encontrado' });
        const name = data.name === undefined ? current.name : clean(data.name);
        const email = data.email === undefined ? current.email : clean(data.email);
        const phone = data.phone === undefined ? current.phone : normalizePhone(data.phone);
        const address = data.address === undefined ? current.address : clean(data.address);
        const whatsapp = data.whatsappOptIn === undefined ? Boolean(current.whatsapp) : Boolean(data.whatsappOptIn);
        const problem = nameError(name) || emailError(email) || phoneError(phone)
          || (address && address.length < 5 ? 'La dirección es muy corta.' : null);
        if (problem) return json(res, 400, { error: problem });
        execute(
          'UPDATE dim_affiliates SET name = ?, email = ?, phone = ?, address = ?, whatsapp_opt_in = ? WHERE affiliate_id = ?',
          [name, email, phone, address || null, whatsapp ? 1 : 0, user.sub],
        );
        publishEvent('profile.updated', { id: user.sub, affiliateId: user.sub });
        return json(res, 200, { updated: true, id: user.sub, name, email, phone, address, whatsappOptIn: whatsapp });
      },
    },
    {
      method: 'GET',
      path: '/staff/overview',
      handler: async (req, res) => {
        if (!requireAdministrator(req, res)) return;
        const [healthcare, pqrs, medsLabs] = await Promise.all([
          tryCallService('healthcare', '/internal/stats', {}, {}),
          tryCallService('pqrs', '/internal/stats', {}, {}),
          tryCallService('meds-labs', '/internal/stats', {}, {}),
        ]);
        const counts = queryOne(`
          SELECT (SELECT COUNT(*) FROM user_roles WHERE role = 'affiliate') AS affiliates,
                 (SELECT COUNT(*) FROM user_roles WHERE role = 'doctor') AS doctors`);
        return json(res, 200, { items: { ...counts, ...healthcare, ...pqrs, ...medsLabs } });
      },
    },
    {
      method: 'GET',
      path: '/staff/users',
      handler: (req, res) => {
        if (!requireAdministrator(req, res)) return;
        const users = queryRows(
          `SELECT a.affiliate_id AS id, a.name, a.document, a.email, a.status
           FROM dim_affiliates a ORDER BY a.name COLLATE NOCASE`,
        ).map(user => ({ ...user, roles: rolesOf(user.id) }));
        return json(res, 200, { items: users, availableRoles });
      },
    },
    {
      method: 'PUT',
      path: '/staff/roles',
      handler: async (req, res) => {
        if (!requireAdministrator(req, res)) return;
        const data = await readJson(req);
        const userId = clean(data.userId);
        const roles = [...new Set(Array.isArray(data.roles) ? data.roles : [])];
        if (!userId || !roles.length || roles.some(role => !availableRoles.includes(role))) {
          return json(res, 400, { error: 'Usuario y al menos un rol válido son obligatorios' });
        }
        if (!queryOne('SELECT 1 AS ok FROM dim_affiliates WHERE affiliate_id = ?', [userId])) return json(res, 404, { error: 'Usuario no encontrado' });
        // Un médico nuevo queda con ficha profesional (sin horario) en healthcare-service.
        if (roles.includes('doctor')) {
          await callService('healthcare', '/internal/doctors', { method: 'POST', body: { doctorId: userId, onlyIfMissing: true } });
        }
        db.transaction(() => {
          execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
          roles.forEach(role => execute('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [userId, role]));
          execute('UPDATE dim_affiliates SET role = ? WHERE affiliate_id = ?', [roles[0], userId]);
        });
        return json(res, 200, { updated: true, userId, roles });
      },
    },
    {
      method: 'GET',
      path: '/staff/lookup',
      handler: (req, res, url) => {
        if (!requireAdministrator(req, res)) return;
        const person = queryOne(
          'SELECT affiliate_id AS id, name, email, phone FROM dim_affiliates WHERE document = ?',
          [clean(url.searchParams.get('document'))],
        );
        if (!person) return json(res, 200, { exists: false });
        return json(res, 200, { exists: true, ...person, roles: rolesOf(person.id) });
      },
    },
    {
      // El administrador agrega un médico. Si el documento ya existe (p. ej. un afiliado),
      // se le agrega el perfil médico a la misma persona en lugar de crear otra cuenta.
      method: 'POST',
      path: '/staff/doctors',
      handler: async (req, res) => {
        if (!requireAdministrator(req, res)) return;
        const data = await readJson(req);
        const document = clean(data.document);
        const name = clean(data.name);
        const password = String(data.password || '');
        const specialty = String(data.specialty || '');
        const slotMinutes = Number(data.slotMinutes) || 20;
        const license = clean(data.license) || null;
        const site = clean(data.site) || null;
        const email = clean(data.email) || null;
        const phone = normalizePhone(data.phone) || null;
        const docProblem = documentError(document);
        if (docProblem) return json(res, 400, { error: docProblem });
        if (!SPECIALTIES.includes(specialty)) return json(res, 400, { error: 'Selecciona una especialidad válida.' });
        if (!license) return json(res, 400, { error: 'El registro profesional (RETHUS / tarjeta profesional) es obligatorio.' });
        if (!Number.isInteger(slotMinutes) || slotMinutes < 10 || slotMinutes > 120) return json(res, 400, { error: 'La duración de la cita debe estar entre 10 y 120 minutos.' });
        const contactProblem = emailError(email, { required: false }) || phoneError(phone, { required: false });
        if (contactProblem) return json(res, 400, { error: contactProblem });

        let person = queryOne('SELECT affiliate_id AS id, name FROM dim_affiliates WHERE document = ?', [document]);
        let created = false;
        if (person) {
          if (rolesOf(person.id).includes('doctor')) return json(res, 409, { error: `${person.name} ya está registrado como médico.` });
        } else {
          const problem = nameError(name) || passwordError(password);
          if (problem) return json(res, 400, { error: problem.replace('La contraseña', 'La contraseña temporal') });
          person = { id: `doc-${Date.now()}`, name };
          created = true;
        }
        // Primero la ficha profesional en healthcare-service; si falla no se crea nada aquí.
        await callService('healthcare', '/internal/doctors', {
          method: 'POST', body: { doctorId: person.id, specialty, license, site, slotMinutes, active: true },
        });
        db.transaction(() => {
          if (created) {
            execute(
              `INSERT INTO dim_affiliates (affiliate_id, name, document, password, email, phone, whatsapp_opt_in, role, status, plan_id)
               VALUES (?, ?, ?, ?, ?, ?, 0, 'doctor', 'active', ?)`,
              [person.id, name, document, hashPassword(password), email, phone, planId('Régimen contributivo', 'contributivo')],
            );
            if (data.alsoAffiliate) execute("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'affiliate')", [person.id]);
          }
          execute("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'doctor')", [person.id]);
        });
        return json(res, created ? 201 : 200, { doctor: { id: person.id, name: person.name, document, specialty }, created, roles: rolesOf(person.id) });
      },
    },
    {
      // Formulario Único de Afiliación (botón "Afiliarme").
      method: 'POST',
      path: '/affiliations',
      handler: async (req, res) => {
        const data = await readJson(req);
        const now = bogotaNow();
        const error = validateAffiliation(data, now.date);
        if (error) return json(res, 400, { error });
        const document = clean(data.document).toUpperCase();
        const beneficiaries = Array.isArray(data.beneficiaries) ? data.beneficiaries : [];
        for (const person of beneficiaries) {
          const taken = queryOne('SELECT 1 AS ok FROM dim_beneficiaries WHERE document_type = ? AND document = ?', [person.documentType, clean(person.document).toUpperCase()])
            || queryOne('SELECT 1 AS ok FROM dim_affiliates WHERE document = ?', [clean(person.document).toUpperCase()]);
          if (taken) return json(res, 409, { error: `El beneficiario con documento ${person.document} ya está afiliado. No se permite la multiafiliación.` });
        }

        const name = [data.firstName, data.secondName, data.firstSurname, data.secondSurname].map(clean).filter(Boolean).join(' ');
        const planName = data.regime === 'subsidiado' ? 'Régimen subsidiado' : 'Régimen contributivo';
        const plan = planId(planName, data.regime);
        const filingNumber = `AFI-${now.date.slice(0, 4)}-${String(Math.floor(100000 + Math.random() * 900000))}`;
        const effectiveDate = addDays(now.date, 1); // los servicios se prestan desde el día siguiente a la afiliación
        const fields = {
          document_type: data.documentType, first_name: clean(data.firstName), second_name: clean(data.secondName) || null,
          first_surname: clean(data.firstSurname), second_surname: clean(data.secondSurname) || null,
          birth_date: data.birthDate, sex: data.sex, department: clean(data.department), city: clean(data.city),
          zone: data.zone === 'rural' ? 'rural' : 'urbana', address: clean(data.address), neighborhood: clean(data.neighborhood) || null,
          landline: clean(data.landline) || null, email: clean(data.email), phone: normalizePhone(data.phone),
          whatsapp_opt_in: data.whatsappOptIn === false ? 0 : 1,
          affiliate_type: data.regime === 'subsidiado' ? 'cabeza_familia' : data.affiliateType,
          employer_name: clean(data.employerName) || null, employer_nit: clean(data.employerNit).replace(/\D/g, '') || null,
          base_income: String(data.baseIncome || '').replace(/\D/g, '') || null, economic_activity: clean(data.economicActivity) || null,
          pension_fund: clean(data.pensionFund) || null, sisben_group: clean(data.sisbenGroup).toUpperCase() || null,
          previous_eps: clean(data.previousEps) || null, primary_ips: clean(data.primaryIps),
          filing_number: filingNumber, effective_date: effectiveDate, plan_id: plan,
        };

        const existing = queryOne('SELECT affiliate_id AS id, password FROM dim_affiliates WHERE document = ?', [document]);
        let affiliateId;
        let linked = false;
        if (existing) {
          if (rolesOf(existing.id).includes('affiliate')) return json(res, 409, { error: 'Ese documento ya está afiliado a Detritus Salud. Usa el botón Ingresar.' });
          if (!verifyPassword(data.password, existing.password)) {
            return json(res, 409, { error: 'Este documento ya está registrado como profesional de la EPS. Usa la misma contraseña con la que ingresas como médico para vincular tu afiliación.' });
          }
          affiliateId = existing.id;
          linked = true;
        } else {
          affiliateId = `user-${Date.now()}`;
        }
        db.transaction(() => {
          if (linked) {
            execute(
              `UPDATE dim_affiliates SET name = ?, ${Object.keys(fields).map(column => `${column} = ?`).join(', ')} WHERE affiliate_id = ?`,
              [name, ...Object.values(fields), affiliateId],
            );
          } else {
            const columns = ['affiliate_id', 'name', 'document', 'password', 'role', 'status', ...Object.keys(fields)];
            execute(
              `INSERT INTO dim_affiliates (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
              [affiliateId, name, document, hashPassword(data.password), 'affiliate', 'active', ...Object.values(fields)],
            );
          }
          execute("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'affiliate')", [affiliateId]);
          beneficiaries.forEach(person => execute(
            `INSERT INTO dim_beneficiaries (affiliate_id, document_type, document, name, relationship, birth_date, sex)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [affiliateId, person.documentType, clean(person.document).toUpperCase(), clean(person.name), person.relationship,
              person.birthDate, ['F', 'M'].includes(person.sex) ? person.sex : null],
          ));
        });
        publishEvent('affiliation.created', { id: filingNumber, affiliateId, effectiveDate, plan: planName });
        return json(res, 201, {
          id: affiliateId, name, document, plan: planName, filingNumber, effectiveDate, linked,
          beneficiaries: beneficiaries.length, primaryIps: fields.primary_ips,
        });
      },
    },
    {
      method: 'POST',
      path: '/register',
      handler: async (req, res) => {
        const data = await readJson(req);
        const name = clean(data.name);
        const document = clean(data.document);
        const password = String(data.password || '');
        const planName = data.plan === 'subsidiado' ? 'Régimen subsidiado' : 'Régimen contributivo';
        const email = clean(data.email);
        const phone = normalizePhone(data.phone);

        const problem = nameError(name) || documentError(document) || emailError(email) || phoneError(phone);
        if (problem) return json(res, 400, { error: problem });
        const existing = queryOne('SELECT affiliate_id AS id, name, password FROM dim_affiliates WHERE document = ?', [document]);
        if (existing) {
          const roles = rolesOf(existing.id);
          if (roles.includes('affiliate')) {
            return json(res, 409, { error: 'Ese documento ya tiene cuenta de afiliado. Usa el botón Ingresar.' });
          }
          // La persona ya existe como médico/administrador: se le agrega la afiliación sin duplicar el documento.
          if (!verifyPassword(password, existing.password)) {
            return json(res, 409, {
              error: 'Este documento ya está registrado como profesional de la EPS. Escribe la misma contraseña con la que ingresas como médico para vincular tu cuenta de afiliado.',
              linkable: true,
            });
          }
          execute("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'affiliate')", [existing.id]);
          execute('UPDATE dim_affiliates SET email = COALESCE(email, ?), phone = COALESCE(phone, ?) WHERE affiliate_id = ?', [email, phone, existing.id]);
          return json(res, 200, { id: existing.id, name: existing.name, document, status: 'active', linked: true, roles: [...roles, 'affiliate'] });
        }
        const passwordProblem = passwordError(password);
        if (passwordProblem) return json(res, 400, { error: passwordProblem });

        const affiliateId = `user-${Date.now()}`;
        db.transaction(() => {
          execute(
            `INSERT INTO dim_affiliates (affiliate_id, name, document, password, email, phone, whatsapp_opt_in, role, status, plan_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'affiliate', 'active', ?)`,
            [affiliateId, name, document, hashPassword(password), email, phone, data.whatsappOptIn === false ? 0 : 1,
              planId(planName, data.plan === 'subsidiado' ? 'subsidiado' : 'contributivo')],
          );
          execute("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'affiliate')", [affiliateId]);
        });
        publishEvent('user.registered', { id: affiliateId, affiliateId });
        return json(res, 201, { id: affiliateId, name, document, status: 'active', plan: planName });
      },
    },

    // ---------- Rutas internas (solo para otros microservicios) ----------
    {
      // ?ids=a,b,c  ·  ?document=123  ·  ?role=doctor
      method: 'GET',
      path: '/internal/people',
      handler: (req, res, url) => {
        if (!requireInternal(req, res)) return;
        const ids = (url.searchParams.get('ids') || '').split(',').map(clean).filter(Boolean);
        const document = clean(url.searchParams.get('document'));
        const role = url.searchParams.get('role');
        const base = `SELECT ${PERSON_COLUMNS} FROM dim_affiliates a JOIN dim_plans p ON p.plan_id = a.plan_id`;
        let rows = [];
        if (ids.length) rows = queryRows(`${base} WHERE a.affiliate_id IN (${ids.map(() => '?').join(',')})`, ids);
        else if (document) rows = queryRows(`${base} WHERE UPPER(a.document) = UPPER(?)`, [document]);
        else if (role) rows = queryRows(`${base} JOIN user_roles ur ON ur.user_id = a.affiliate_id WHERE ur.role = ? ORDER BY a.name COLLATE NOCASE`, [role]);
        return json(res, 200, { items: rows.map(toPerson) });
      },
    },
    {
      // auth-service valida aquí documento + contraseña; la contraseña nunca sale de esta base.
      method: 'POST',
      path: '/internal/credentials/verify',
      handler: async (req, res) => {
        if (!requireInternal(req, res)) return;
        const { document, password } = await readJson(req);
        const user = queryOne(
          'SELECT affiliate_id AS id, name, document, password, status FROM dim_affiliates WHERE document = ?',
          [clean(document)],
        );
        if (!user || !verifyPassword(password, user.password)) return json(res, 401, { error: 'Documento o contraseña incorrectos.' });
        const { password: _hidden, ...safe } = user;
        return json(res, 200, { user: { ...safe, roles: rolesOf(user.id) } });
      },
    },
    {
      method: 'POST',
      path: '/internal/password',
      handler: async (req, res) => {
        if (!requireInternal(req, res)) return;
        const { userId, password } = await readJson(req);
        const problem = passwordError(password);
        if (problem) throw new HttpError(400, problem);
        const changed = execute('UPDATE dim_affiliates SET password = ?, password_changed_at = ? WHERE affiliate_id = ?',
          [hashPassword(password), bogotaNow().iso, userId]);
        if (!changed) return json(res, 404, { error: 'Usuario no encontrado.' });
        return json(res, 200, { updated: true });
      },
    },
  ],
});
