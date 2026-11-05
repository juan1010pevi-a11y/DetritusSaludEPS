import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import { startBackend } from './helpers.js';

// Escenario: lunes 2 de noviembre de 2026, 6:00 a. m. (FAKE_NOW en helpers.js).
const MONDAY = '2026-11-02';
const require = createRequire(import.meta.url);

let backend;
let api;
let tokens = {};

before(async () => {
  backend = await startBackend();
  api = backend.api;
  tokens = {
    affiliate: await backend.login('123456789', 'demo123', 'affiliate'),
    laura: await backend.login('1010101010', 'demo123', 'affiliate'),
    admin: await backend.login('900000002', 'admin123', 'administrator'),
    general2: await backend.login('900000008', 'medico123', 'doctor'),
    pediatrics: await backend.login('900000003', 'medico123', 'doctor'),
    psychology: await backend.login('900000006', 'medico123', 'doctor'),
    lab: await backend.login('900000007', 'medico123', 'doctor'),
  };
});

after(async () => {
  await backend?.stop();
});

const myAppointments = async token => (await api('/healthcare/appointments/mine', { token })).data.items;
const myNotifications = async token => (await api('/notifications/notifications/mine', { token })).data.items;

describe('Base de datos por microservicio', () => {
  test('cada microservicio crea su propio archivo SQLite', async () => {
    const files = fs.readdirSync(backend.dataDir).filter(file => file.endsWith('.sqlite')).sort();
    assert.deepEqual(files, ['auth.sqlite', 'content.sqlite', 'healthcare.sqlite', 'meds-labs.sqlite', 'notifications.sqlite', 'pqrs.sqlite', 'users.sqlite']);
    const health = await api('/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.databases.pqrs, 'pqrs.sqlite');
  });

  test('ninguna base guarda las tablas de otro servicio', async () => {
    const SQL = await initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
    const tables = name => {
      const database = new SQL.Database(fs.readFileSync(path.join(backend.dataDir, `${name}.sqlite`)));
      const rows = database.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")[0]?.values.flat() || [];
      database.close();
      return rows;
    };
    assert.ok(tables('users').includes('dim_affiliates'));
    assert.ok(!tables('users').includes('fact_appointments'));
    assert.ok(tables('healthcare').includes('fact_appointments'));
    assert.ok(tables('healthcare').includes('clinical_encounters'));
    assert.ok(!tables('healthcare').includes('dim_affiliates'));
    assert.deepEqual(tables('pqrs').sort(), ['fact_pqrs', 'pqrs_status_history']);
    assert.deepEqual(tables('notifications'), ['fact_notifications']);
    assert.ok(tables('meds-labs').includes('fact_prescriptions'));
    assert.ok(!tables('meds-labs').includes('fact_appointments'));
    assert.deepEqual(tables('auth').sort(), ['login_attempts', 'password_resets']);
  });

  test('el gateway no expone las rutas internas', async () => {
    const response = await api('/users/internal/people?role=doctor');
    assert.equal(response.status, 404);
  });
});

describe('Validaciones de datos numéricos', () => {
  test('el login rechaza documentos con letras o puntos', async () => {
    const response = await api('/auth/login', { method: 'POST', body: { document: '12.345.678', password: 'x' } });
    assert.equal(response.status, 400);
    assert.match(response.data.error, /solo puede tener números/);
  });

  test('el registro valida documento, celular, correo y contraseña', async () => {
    const valid = { name: 'Carlos Prueba', document: '1098765432', email: 'carlos@example.com', phone: '3105551234', password: 'clave2026' };
    for (const [field, value, message] of [
      ['document', '10987abc', /solo puede tener números/],
      ['phone', '12345', /10 dígitos/],
      ['email', 'carlos@', /correo/],
      ['password', 'abc', /mínimo 8/],
      ['name', 'Carlos 123', /letras/],
    ]) {
      const response = await api('/users/register', { method: 'POST', body: { ...valid, [field]: value } });
      assert.equal(response.status, 400, `${field} debía rechazarse`);
      assert.match(response.data.error, message);
    }
    const created = await api('/users/register', { method: 'POST', body: valid });
    assert.equal(created.status, 201);
    assert.ok(await backend.login('1098765432', 'clave2026', 'affiliate'));
  });
});

describe('Inicio de sesión seguro', () => {
  test('bloquea el documento tras 5 intentos fallidos', async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await api('/auth/login', { method: 'POST', body: { document: '900000005', password: 'equivocada' } });
      assert.equal(response.status, 401);
    }
    const blocked = await api('/auth/login', { method: 'POST', body: { document: '900000005', password: 'medico123' } });
    assert.equal(blocked.status, 429);
  });

  test('la API nunca devuelve la contraseña', async () => {
    const me = await api('/auth/me', { token: tokens.affiliate });
    assert.equal(me.status, 200);
    assert.equal(JSON.stringify(me.data).includes('password'), false);
    const users = await api('/users/staff/users', { token: tokens.admin });
    assert.equal(JSON.stringify(users.data).includes('password'), false);
  });
});

describe('Citas sin cruces de horario', () => {
  test('agenda una cita de medicina general', async () => {
    const response = await api('/healthcare/appointments', {
      method: 'POST', token: tokens.affiliate,
      body: { specialty: 'Medicina general', doctorId: 'staff-doctor', date: MONDAY, time: '08:20', reason: 'Dolor de cabeza frecuente' },
    });
    assert.equal(response.status, 201, response.data?.error);
    assert.equal(response.data.appointment.duration, 20);
  });

  test('otro paciente no puede tomar el mismo cupo del médico', async () => {
    const response = await api('/healthcare/appointments', {
      method: 'POST', token: tokens.laura,
      body: { specialty: 'Medicina general', doctorId: 'staff-doctor', date: MONDAY, time: '08:20' },
    });
    assert.equal(response.status, 409);
  });

  test('el paciente no puede agendar otra cita que se cruce, aunque sea 10 minutos después', async () => {
    const response = await api('/healthcare/appointments', {
      method: 'POST', token: tokens.affiliate,
      body: { specialty: 'Odontología', doctorId: 'doc-odontologia', date: MONDAY, time: '08:30' },
    });
    assert.equal(response.status, 409);
    assert.match(response.data.error, /se cruza/);
  });

  test('la disponibilidad excluye cruces y cupos sin tiempo de traslado entre sedes', async () => {
    const response = await api(`/healthcare/availability?specialty=Odontolog%C3%ADa&from=${MONDAY}&days=1`, { token: tokens.affiliate });
    const times = response.data.days[0].slots.map(slot => slot.time);
    assert.ok(!times.includes('08:00'), '08:00-08:30 se cruza con 08:20-08:40');
    assert.ok(!times.includes('08:30'));
    assert.ok(!times.includes('09:00'), '09:00 deja solo 20 minutos para trasladarse de Chapinero a Kennedy');
    assert.ok(times.includes('09:30'));
  });

  test('el servidor rechaza una cita en otra sede sin el tiempo mínimo de traslado', async () => {
    const response = await api('/healthcare/appointments', {
      method: 'POST', token: tokens.affiliate,
      body: { specialty: 'Odontología', doctorId: 'doc-odontologia', date: MONDAY, time: '09:00' },
    });
    assert.equal(response.status, 409);
    assert.match(response.data.error, /al menos 30 minutos/);
  });

  test('el mismo médico no recibe citas consecutivas sin 20 minutos de margen', async () => {
    const registration = await api('/users/register', {
      method: 'POST',
      body: {
        name: 'Paciente Agenda',
        document: '1098765433',
        email: 'paciente.agenda@example.com',
        phone: '3105551235',
        password: 'clave2026',
      },
    });
    assert.equal(registration.status, 201, registration.data?.error);
    const patientToken = await backend.login('1098765433', 'clave2026', 'affiliate');
    const first = await api('/healthcare/appointments', {
      method: 'POST', token: patientToken,
      body: { specialty: 'Medicina general', doctorId: 'user-002', date: '2026-11-05', time: '14:00' },
    });
    assert.equal(first.status, 201, first.data?.error);

    const availability = await api(
      '/healthcare/availability?specialty=Medicina%20general&doctorId=user-002&from=2026-11-05&days=1',
      { token: patientToken },
    );
    const times = availability.data.days[0].slots.map(slot => slot.time);
    assert.ok(!times.includes('14:20'), 'el cupo contiguo no deja margen al profesional');
    assert.ok(times.includes('14:40'), 'después de 20 minutos libres se ofrece el cupo');

    const second = await api('/healthcare/appointments', {
      method: 'POST', token: patientToken,
      body: { specialty: 'Medicina general', doctorId: 'user-002', date: '2026-11-05', time: '14:20' },
    });
    assert.equal(second.status, 409);
    assert.match(second.data.error, /al menos 20 minutos/);
  });
});

describe('Incapacidad del médico', () => {
  test('la cita se reasigna a otro médico de la misma especialidad a la misma hora', async () => {
    const response = await api('/healthcare/doctor/absences', {
      method: 'POST', token: tokens.admin,
      body: { doctorId: 'staff-doctor', type: 'incapacidad', startDate: MONDAY, endDate: MONDAY, notes: 'Incapacidad por 1 día' },
    });
    assert.equal(response.status, 201, response.data?.error);
    assert.equal(response.data.reassigned.length, 1);
    const appointment = (await myAppointments(tokens.affiliate)).find(item => item.date === MONDAY && item.time === '08:20');
    assert.equal(appointment.doctorId, 'doc-general-2');
    assert.equal(appointment.status, 'confirmed');
    assert.equal(appointment.originalDoctorName, 'Médico demo');
    assert.match(appointment.changeNote, /Reasignada/);
  });

  test('el médico incapacitado no aparece en la disponibilidad de esas fechas', async () => {
    const response = await api(`/healthcare/availability?specialty=Medicina%20general&from=${MONDAY}&days=1`, { token: tokens.laura });
    assert.ok(response.data.days[0].slots.every(slot => slot.doctorId !== 'staff-doctor'));
  });

  test('si no hay reemplazo la cita queda por reprogramar y el paciente elige un nuevo horario', async () => {
    const booked = await api('/healthcare/appointments', {
      method: 'POST', token: tokens.affiliate,
      body: { specialty: 'Psicología', doctorId: 'doc-psicologia', date: MONDAY, time: '09:00', modality: 'Teleconsulta' },
    });
    assert.equal(booked.status, 201, booked.data?.error);
    const absence = await api('/healthcare/doctor/absences', {
      method: 'POST', token: tokens.psychology,
      body: { type: 'incapacidad', startDate: MONDAY, endDate: '2026-11-03' },
    });
    assert.equal(absence.status, 201, absence.data?.error);
    assert.equal(absence.data.toReschedule.length, 1);
    const pending = (await myAppointments(tokens.affiliate)).find(item => item.id === booked.data.appointment.id);
    assert.equal(pending.status, 'reschedule_required');

    const availability = await api(`/healthcare/availability?specialty=Psicolog%C3%ADa&from=${MONDAY}&days=3`, { token: tokens.affiliate });
    assert.equal(availability.data.days[0].total, 0);
    assert.equal(availability.data.days[1].total, 0);
    const slot = availability.data.days[2].slots[0];
    const moved = await api('/healthcare/appointments/reschedule', {
      method: 'POST', token: tokens.affiliate, body: { id: pending.id, doctorId: slot.doctorId, date: '2026-11-04', time: slot.time },
    });
    assert.equal(moved.status, 200, moved.data?.error);
    assert.equal(moved.data.appointment.status, 'confirmed');
    assert.equal(moved.data.appointment.date, '2026-11-04');
  });
});

describe('Historia clínica', () => {
  let appointment;

  test('solo el médico tratante puede ver la historia clínica', async () => {
    appointment = (await myAppointments(tokens.affiliate)).find(item => item.date === MONDAY && item.time === '08:20');
    const own = await api('/healthcare/clinical-history?patientId=user-001', { token: tokens.general2 });
    assert.equal(own.status, 200);
    assert.equal(own.data.background.bloodType, 'O+');
    const other = await api('/healthcare/clinical-history?patientId=user-001', { token: tokens.pediatrics });
    assert.equal(other.status, 403);
    const admin = await api('/healthcare/clinical-history?patientId=user-001', { token: tokens.admin });
    assert.equal(admin.status, 403);
  });

  test('una consulta no se puede cerrar sin registrar la historia clínica', async () => {
    const response = await api(`/healthcare/appointments?id=${appointment.id}`, { method: 'PATCH', token: tokens.general2, body: { status: 'completed' } });
    assert.equal(response.status, 400);
  });

  test('valida los signos vitales', async () => {
    const response = await api('/healthcare/appointments/attend', {
      method: 'POST', token: tokens.general2,
      body: { id: appointment.id, diagnosis: 'Cefalea tensional', chiefComplaint: 'Dolor de cabeza', vitals: { bloodPressure: '300/20' } },
    });
    assert.equal(response.status, 400);
    assert.match(response.data.error, /tensión arterial/);
  });

  test('al atender la cita se registra la evolución y el paciente la ve en su historia', async () => {
    const response = await api('/healthcare/appointments/attend', {
      method: 'POST', token: tokens.general2,
      body: {
        id: appointment.id, chiefComplaint: 'Dolor de cabeza frecuente', currentIllness: 'Cefalea de 2 semanas',
        vitals: { bloodPressure: '120/80', heartRate: '72', respiratoryRate: '16', temperature: '36.6', weightKg: '70', heightCm: '170', oxygenSaturation: '98' },
        physicalExam: 'Sin hallazgos neurológicos', diagnosis: 'Cefalea tensional', diagnosisCode: 'G44.2', plan: 'Acetaminofén y control en 1 mes',
        authorizations: [{ serviceCode: 'TAC', reason: 'Descartar lesión estructural', priority: 'normal' }],
      },
    });
    assert.equal(response.status, 200, response.data?.error);
    assert.equal(response.data.appointment.status, 'completed');
    const history = await api('/healthcare/clinical-history/mine', { token: tokens.affiliate });
    assert.equal(history.status, 200);
    const encounter = history.data.encounters.find(item => item.appointmentId === appointment.id);
    assert.equal(encounter.bloodPressure, '120/80');
    assert.equal(encounter.diagnosisCode, 'G44.2');
    assert.equal(history.data.encounters.length, 2, 'incluye la consulta anterior de demostración');
    assert.ok(history.data.orders.some(order => order.serviceName.includes('Tomografía')));
  });

  test('el médico formula medicamentos de la consulta atendida', async () => {
    const response = await api('/meds-labs/prescriptions', {
      method: 'POST', token: tokens.general2,
      body: { appointmentId: appointment.id, items: [{ medication: 'Acetaminofén 500 mg tableta', dosage: '1 tableta cada 8 horas', quantity: 15 }] },
    });
    assert.equal(response.status, 201, response.data?.error);
    const history = await api('/healthcare/clinical-history/mine', { token: tokens.affiliate });
    assert.ok(history.data.prescriptions.some(item => item.formulaNumber === response.data.formulaNumber));
  });
});

describe('Laboratorio', () => {
  test('de la cita al resultado publicado', async () => {
    const booked = await api('/healthcare/appointments', {
      method: 'POST', token: tokens.affiliate,
      body: { specialty: 'Laboratorio clínico', doctorId: 'doc-laboratorio', date: MONDAY, time: '06:45', examCode: 'GLICEMIA' },
    });
    assert.equal(booked.status, 201, booked.data?.error);
    const { id, labOrderNumber } = booked.data.appointment;
    assert.match(labOrderNumber, /^LAB-2026-\d{6}$/);
    const sample = await api(`/healthcare/appointments?id=${id}`, { method: 'PATCH', token: tokens.lab, body: { status: 'completed' } });
    assert.equal(sample.status, 200, sample.data?.error);
    const worklist = await api('/meds-labs/lab-results/worklist', { token: tokens.lab });
    const document = worklist.data.items.find(item => item.orderNumber === labOrderNumber);
    const invalid = await api('/meds-labs/lab-results/document', {
      method: 'PUT', token: tokens.lab, body: { orderNumber: labOrderNumber, items: [{ id: document.items[0].id, value: 'alto' }], publish: true },
    });
    assert.equal(invalid.status, 400);
    const saved = await api('/meds-labs/lab-results/document', {
      method: 'PUT', token: tokens.lab, body: { orderNumber: labOrderNumber, items: [{ id: document.items[0].id, value: '92' }], publish: true },
    });
    assert.equal(saved.status, 200, saved.data?.error);
    assert.equal(saved.data.document.status, 'available');
    const mine = await api('/meds-labs/lab-results/mine', { token: tokens.affiliate });
    assert.equal(mine.data.items.find(item => item.orderNumber === labOrderNumber).status, 'available');
  });
});

describe('PQRS', () => {
  let filing;

  test('valida los datos de contacto y el documento', async () => {
    const response = await api('/pqrs/requests', {
      method: 'POST',
      body: { type: 'Queja', subject: 'Demora en la atención', name: 'Ana Ruiz', document: '52.123.456', email: 'ana@example.com', phone: '3001112222', description: 'Esperé dos horas para ser atendida en la sede.', acceptDataPolicy: true },
    });
    assert.equal(response.status, 400);
  });

  test('radica una PQRS y se notifica por correo, SMS y WhatsApp aunque no sea afiliada', async () => {
    const response = await api('/pqrs/requests', {
      method: 'POST',
      body: { type: 'Queja', subject: 'Demora en la atención', name: 'Ana Ruiz', document: '52123456', email: 'ana@example.com', phone: '3001112222', description: 'Esperé dos horas para ser atendida en la sede de Chapinero.', acceptDataPolicy: true },
    });
    assert.equal(response.status, 201, response.data?.error);
    filing = response.data.request;
    assert.match(filing.id, /^PQRS-2026-\d{6}$/);
    assert.equal(filing.dueDate, '2026-11-23');
    const sent = await backend.eventually(async () => {
      const list = await api('/notifications/notifications', { token: tokens.admin });
      const rows = list.data.items.filter(item => item.reference === filing.id);
      return rows.length >= 3 ? rows : null;
    });
    assert.deepEqual(sent.map(item => item.channel).sort(), ['email', 'sms', 'whatsapp']);
    assert.ok(sent.every(item => item.status === 'simulated'));
  });

  test('la consulta pública exige radicado y documento', async () => {
    assert.equal((await api(`/pqrs/requests?id=${filing.id}`)).status, 400);
    const found = await api(`/pqrs/requests?id=${filing.id}&document=52123456`);
    assert.equal(found.data.items.length, 1);
    const wrong = await api(`/pqrs/requests?id=${filing.id}&document=1111111222`);
    assert.equal(wrong.data.items.length, 0);
  });

  test('el administrador responde y queda el historial', async () => {
    const short = await api(`/pqrs/requests?id=${filing.id}`, { method: 'PATCH', token: tokens.admin, body: { status: 'answered', response: 'Ok' } });
    assert.equal(short.status, 400);
    const answered = await api(`/pqrs/requests?id=${filing.id}`, {
      method: 'PATCH', token: tokens.admin,
      body: { status: 'answered', response: 'Lamentamos la demora. Reforzamos el personal de la sede en las mañanas.' },
    });
    assert.equal(answered.status, 200);
    assert.deepEqual(answered.data.request.history.map(item => item.status), ['received', 'answered']);
  });
});

describe('Notificaciones al afiliado', () => {
  test('cada proceso deja mensajes por correo, SMS y WhatsApp en la bandeja', async () => {
    const expected = ['appointment.created', 'appointment.reassigned', 'appointment.reschedule_required', 'appointment.rescheduled',
      'appointment.updated', 'authorization.created', 'prescription.created', 'lab-result.available'];
    const items = await backend.eventually(async () => {
      const list = await myNotifications(tokens.affiliate);
      return expected.every(type => list.some(item => item.eventType === type)) ? list : null;
    });
    if (!items) {
      const list = await myNotifications(tokens.affiliate);
      assert.fail(`faltan: ${expected.filter(type => !list.some(item => item.eventType === type)).join(', ')}`);
    }
    const created = items.filter(item => item.eventType === 'appointment.created');
    assert.ok(['email', 'sms', 'whatsapp'].every(channel => created.some(item => item.channel === channel)));
    assert.ok(items.every(item => !item.recipient.includes('afiliado.demo')), 'el destinatario se muestra enmascarado');
  });
});

describe('Recuperar contraseña', () => {
  test('envía un código, valida intentos y cambia la contraseña', async () => {
    const requested = await api('/auth/password/forgot', { method: 'POST', body: { document: '123456789' } });
    assert.equal(requested.status, 200);
    assert.match(requested.data.demoCode, /^\d{6}$/);
    assert.ok(requested.data.destinations.every(item => item.includes('*')));
    const again = await api('/auth/password/forgot', { method: 'POST', body: { document: '123456789' } });
    assert.equal(again.status, 429);

    const unknown = await api('/auth/password/forgot', { method: 'POST', body: { document: '777777778' } });
    assert.equal(unknown.status, 200, 'no revela si el documento existe');
    assert.equal(unknown.data.demoCode, undefined);

    const code = requested.data.demoCode;
    const wrongCode = code === '000000' ? '111111' : '000000';
    const bad = await api('/auth/password/reset', { method: 'POST', body: { document: '123456789', code: wrongCode, password: 'nueva2026', passwordConfirm: 'nueva2026' } });
    assert.equal(bad.status, 400);
    const weak = await api('/auth/password/reset', { method: 'POST', body: { document: '123456789', code, password: 'abc', passwordConfirm: 'abc' } });
    assert.equal(weak.status, 400);
    const ok = await api('/auth/password/reset', { method: 'POST', body: { document: '123456789', code, password: 'nueva2026', passwordConfirm: 'nueva2026' } });
    assert.equal(ok.status, 200, ok.data?.error);
    const reused = await api('/auth/password/reset', { method: 'POST', body: { document: '123456789', code, password: 'otra2026x', passwordConfirm: 'otra2026x' } });
    assert.equal(reused.status, 400, 'el código solo sirve una vez');

    assert.equal((await api('/auth/login', { method: 'POST', body: { document: '123456789', password: 'demo123' } })).status, 401);
    assert.ok(await backend.login('123456789', 'nueva2026', 'affiliate'));

    const stored = await backend.eventually(async () => {
      const list = await api('/notifications/notifications', { token: tokens.admin });
      const rows = list.data.items.filter(item => item.eventType === 'password.reset_requested');
      return rows.length ? rows : null;
    });
    assert.ok(stored.every(item => !item.body.includes(code)), 'el código no queda guardado en la base de notificaciones');
  });
});
