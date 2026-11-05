import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bloodPressureError, codeError, documentError, emailError, maskContact, nameError, normalizePhone, numberInRangeError, passwordError, phoneError,
} from '../src/validators.js';
import { freeSlots, overlaps, slotProblem } from '../src/scheduling.js';
import { dueDateFor } from '../src/pqrs-rules.js';
import { renderNotification } from '../src/notification-templates.js';
import { hashPassword, verifyPassword } from '../src/security.js';
import { validateScheduleBlocks } from '../src/clinical-catalog.js';
import { toE164 } from '../src/notification-providers.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('los validadores del frontend y del backend son el mismo archivo', () => {
  const front = fs.readFileSync(path.join(root, 'src', 'lib', 'validators.js'), 'utf8');
  const back = fs.readFileSync(path.join(root, 'backend', 'src', 'validators.js'), 'utf8');
  assert.equal(back, front);
});

test('documento: solo números, entre 5 y 12 dígitos', () => {
  assert.equal(documentError('1020304050'), null);
  assert.equal(documentError('123456789'), null);
  assert.match(documentError('10.203.040'), /solo puede tener números/);
  assert.match(documentError('12ab34'), /solo puede tener números/);
  assert.match(documentError('1234'), /entre 5 y 12/);
  assert.match(documentError('1234567890123'), /entre 5 y 12/);
  assert.match(documentError('0123456'), /no puede empezar por 0/);
  assert.match(documentError('11111111'), /no es válido/);
  assert.match(documentError(''), /Escribe/);
  assert.equal(documentError('AB12345', 'PA'), null, 'el pasaporte admite letras');
});

test('celular, correo, nombre y contraseña', () => {
  assert.equal(phoneError('3001234567'), null);
  assert.equal(phoneError('+57 300 123 4567'), null);
  assert.equal(normalizePhone('+57 300 123 4567'), '3001234567');
  assert.match(phoneError('2001234567'), /empezar por 3/);
  assert.match(phoneError('300123'), /10 dígitos/);
  assert.equal(phoneError('', { required: false }), null);
  assert.equal(emailError('ana@correo.com'), null);
  assert.ok(emailError('ana@correo'));
  assert.equal(nameError('María José Pérez'), null);
  assert.ok(nameError('Ana 123'));
  assert.equal(passwordError('clave2026'), null);
  assert.ok(passwordError('corta1'));
  assert.ok(passwordError('soloLetras'));
  assert.equal(codeError('123456'), null);
  assert.ok(codeError('12345a'));
});

test('signos vitales y rangos numéricos', () => {
  assert.equal(bloodPressureError('120/80'), null);
  assert.ok(bloodPressureError('120-80'));
  assert.ok(bloodPressureError('80/120'));
  assert.equal(numberInRangeError('36.5', { min: 34, max: 42, label: 'La temperatura' }), null);
  assert.match(numberInRangeError('50', { min: 34, max: 42, label: 'La temperatura' }), /entre 34 y 42/);
  assert.match(numberInRangeError('abc', { min: 1, max: 2, label: 'X' }), /número/);
  assert.match(numberInRangeError('70.5', { min: 30, max: 220, label: 'La FC', integer: true }), /entero/);
});

test('enmascara correos y celulares', () => {
  assert.equal(maskContact('afiliado@example.com'), 'af******@example.com');
  assert.equal(maskContact('3001234567'), '******4567');
});

test('dos citas se cruzan si sus intervalos se solapan', () => {
  assert.equal(overlaps('08:00', 30, '08:20', 20), true);
  assert.equal(overlaps('08:20', 20, '08:30', 30), true);
  assert.equal(overlaps('08:00', 20, '08:20', 20), false, 'una termina cuando empieza la otra');
  assert.equal(overlaps('09:00', 30, '08:00', 30), false);
});

test('los cupos libres excluyen cruces con el médico, con el paciente y las ausencias', () => {
  const doctor = { id: 'd1', name: 'Dra. Prueba', slotMinutes: 30 };
  const blocks = [{ weekday: 1, start: '08:00', end: '10:00' }]; // lunes
  const date = '2026-11-02';
  const base = { doctor, blocks, date };
  assert.deepEqual(freeSlots(base), ['08:00', '08:30', '09:00', '09:30']);
  // El médico tiene una cita heredada de 20 minutos a las 08:40: 08:00 y 09:00 no dejan margen.
  assert.deepEqual(freeSlots({ ...base, doctorBusy: [{ time: '08:40', duration: 20 }] }), ['09:30']);
  // El paciente ya tiene otra cita 08:20-08:40 con otro médico: 08:00 y 08:30 se cruzan.
  assert.deepEqual(freeSlots({ ...base, patientBusy: [{ time: '08:20', duration: 20, specialty: 'Medicina general' }] }), ['09:00', '09:30']);
  assert.deepEqual(freeSlots({ ...base, absent: true }), []);
  assert.match(slotProblem({ ...base, time: '08:30', patientBusy: [{ time: '08:20', duration: 20, specialty: 'Medicina general' }] }), /se cruza/);
  assert.match(slotProblem({ ...base, time: '08:15' }), /no tiene ese horario/);
  assert.match(slotProblem({ ...base, time: '08:00', now: { date, minutes: 7 * 60 + 45 }, minLeadMinutes: 30 }), /ya no está disponible/);
});

test('el médico necesita 20 minutos entre sus citas', () => {
  const doctor = { id: 'd1', name: 'Dra. Prueba', slotMinutes: 20 };
  const blocks = [{ weekday: 1, start: '13:00', end: '16:00' }];
  const base = { doctor, blocks, date: '2026-11-02' };
  const existing = [{ time: '14:00', duration: 20 }];

  assert.match(slotProblem({ ...base, time: '14:20', doctorBusy: existing }), /al menos 20 minutos/);
  assert.match(slotProblem({ ...base, time: '13:40', doctorBusy: existing }), /al menos 20 minutos/);
  assert.equal(slotProblem({ ...base, time: '14:40', doctorBusy: existing }), null, '20 minutos libres después sí bastan');
  assert.equal(slotProblem({ ...base, time: '13:20', doctorBusy: existing }), null, '20 minutos libres antes sí bastan');
});

test('las citas presenciales en sedes distintas requieren 30 minutos de traslado', () => {
  const doctor = { id: 'd2', name: 'Dr. Sede distinta', site: 'Sede Chapinero', slotMinutes: 10 };
  const blocks = [{ weekday: 1, start: '13:00', end: '16:00' }];
  const base = { doctor, blocks, date: '2026-11-02' };
  const existing = [{ time: '14:00', duration: 20, site: 'Sede Suba', modality: 'Presencial', specialty: 'Medicina general' }];

  assert.match(slotProblem({ ...base, time: '14:30', patientBusy: existing }), /al menos 30 minutos/);
  assert.match(slotProblem({ ...base, time: '13:30', patientBusy: existing }), /al menos 30 minutos/);
  assert.equal(slotProblem({ ...base, time: '14:50', patientBusy: existing }), null, '30 minutos después de finalizar sí permite el traslado');
  assert.equal(slotProblem({
    ...base, time: '14:20', site: 'Sede Suba', patientBusy: existing,
  }), null, 'no se exige traslado dentro de la misma sede');
  assert.equal(slotProblem({
    ...base, time: '14:20', modality: 'Teleconsulta', patientBusy: existing,
  }), null, 'la teleconsulta no requiere desplazamiento');
});

test('bloques de horario que se cruzan se rechazan', () => {
  assert.equal(validateScheduleBlocks([{ weekday: 1, start: '08:00', end: '12:00' }, { weekday: 1, start: '14:00', end: '17:00' }]), null);
  assert.match(validateScheduleBlocks([{ weekday: 1, start: '08:00', end: '12:00' }, { weekday: 1, start: '11:00', end: '13:00' }]), /se cruzan/);
});

test('plazo legal de PQRS en días hábiles', () => {
  assert.equal(dueDateFor('Petición', '2026-11-02'), '2026-11-23'); // 15 días hábiles desde un lunes
  assert.equal(dueDateFor('Denuncia', '2026-11-02'), '2026-12-14'); // 30 días hábiles
});

test('las plantillas de notificación saludan y no guardan el código como texto suelto', () => {
  const message = renderNotification('password.reset_requested', { code: '654321', minutes: 15 }, 'Ana Pérez');
  assert.match(message.body, /^Hola, Ana:/);
  assert.equal(message.secret, '654321');
  assert.match(message.short, /654321/);
  const pqrs = renderNotification('pqrs.created', { id: 'PQRS-2026-123456', type: 'Queja', subject: 'Demora', dueDate: '2026-11-23' });
  assert.match(pqrs.subject, /PQRS-2026-123456/);
  assert.equal(renderNotification('evento.desconocido', {}), null);
});

test('formato internacional para SMS/WhatsApp', () => {
  assert.equal(toE164('3001234567'), '+573001234567');
});

test('las contraseñas se guardan con hash y sal', () => {
  const hash = hashPassword('clave2026');
  assert.notEqual(hash, 'clave2026');
  assert.ok(verifyPassword('clave2026', hash));
  assert.ok(!verifyPassword('otra', hash));
});

test('el cliente SMTP envía un correo a un servidor SMTP', async () => {
  const { sendSmtpMail } = await import('../src/smtp-client.js');
  const net = await import('node:net');
  const received = [];
  const server = net.createServer(socket => {
    let data = false;
    let buffer = '';
    socket.write('220 prueba ESMTP\r\n');
    socket.on('data', chunk => {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (data) {
          if (line === '.') { data = false; socket.write('250 2.0.0 OK queued\r\n'); } else received.push(line);
          continue;
        }
        if (line.startsWith('EHLO')) socket.write('250-prueba\r\n250 AUTH LOGIN\r\n');
        else if (line === 'AUTH LOGIN') socket.write('334 VXNlcm5hbWU6\r\n');
        else if (line === Buffer.from('eps@example.com').toString('base64')) socket.write('334 UGFzc3dvcmQ6\r\n');
        else if (line === Buffer.from('secreta').toString('base64')) socket.write('235 2.7.0 Accepted\r\n');
        else if (line.startsWith('MAIL FROM') || line.startsWith('RCPT TO')) socket.write('250 OK\r\n');
        else if (line === 'DATA') { data = true; socket.write('354 Go ahead\r\n'); }
        else if (line === 'QUIT') socket.end('221 Bye\r\n');
      }
    });
  });
  await new Promise(resolve => server.listen(0, resolve));
  const result = await sendSmtpMail({
    host: '127.0.0.1', port: server.address().port, user: 'eps@example.com', pass: 'secreta',
    from: 'eps@example.com', to: 'afiliado@example.com', subject: 'Cita confirmada ✔', text: 'Hola, tu cita quedó confirmada.',
  });
  server.close();
  assert.equal(result.accepted, true);
  assert.ok(received.some(line => line.startsWith('Subject: =?UTF-8?B?')));
  const body = Buffer.from(received.slice(received.indexOf('') + 1).join(''), 'base64').toString('utf8');
  assert.equal(body, 'Hola, tu cita quedó confirmada.');
});
