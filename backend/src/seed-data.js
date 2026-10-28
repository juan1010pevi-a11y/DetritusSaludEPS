// Datos de demostración. users-service crea las personas y healthcare-service
// crea la ficha profesional y el horario de los médicos con los mismos ids.

export const DEMO_PEOPLE = [
  { id: 'user-001', name: 'Afiliado demo', document: '123456789', password: 'demo123', roles: ['affiliate'],
    email: 'afiliado.demo@example.com', phone: '3001234567', whatsapp: 1 },
  { id: 'staff-doctor', name: 'Médico demo', document: '900000001', password: 'doctor123', roles: ['doctor'],
    email: 'medico.demo@example.com', phone: '3001112233', whatsapp: 1 },
  { id: 'staff-admin', name: 'Administrador demo', document: '900000002', password: 'admin123', roles: ['administrator'],
    email: 'admin.demo@example.com', phone: '3009998877', whatsapp: 0 },
  { id: 'doc-pediatria', name: 'Dra. Natalia Pardo', document: '900000003', password: 'medico123', roles: ['doctor'], email: 'natalia.pardo@example.com', phone: '3101000003' },
  { id: 'doc-interna', name: 'Dr. Felipe Castaño', document: '900000004', password: 'medico123', roles: ['doctor'], email: 'felipe.castano@example.com', phone: '3101000004' },
  { id: 'doc-odontologia', name: 'Dra. Paula Méndez', document: '900000005', password: 'medico123', roles: ['doctor'], email: 'paula.mendez@example.com', phone: '3101000005' },
  { id: 'doc-psicologia', name: 'Ps. Daniel Ortiz', document: '900000006', password: 'medico123', roles: ['doctor'], email: 'daniel.ortiz@example.com', phone: '3101000006' },
  { id: 'doc-laboratorio', name: 'Bact. Sandra Ruiz', document: '900000007', password: 'medico123', roles: ['doctor'], email: 'sandra.ruiz@example.com', phone: '3101000007' },
  // Persona que es afiliada y además médica: un solo documento con dos perfiles.
  { id: 'user-002', name: 'Laura Gómez', document: '1010101010', password: 'demo123', roles: ['affiliate', 'doctor'],
    email: 'laura.gomez@example.com', phone: '3157654321', whatsapp: 1 },
  // Segundo médico general: permite reasignar citas cuando un médico se incapacita.
  { id: 'doc-general-2', name: 'Dr. Andrés Rojas', document: '900000008', password: 'medico123', roles: ['doctor'], email: 'andres.rojas@example.com', phone: '3101000008' },
];

// [id, especialidad, registro, sede, minutos por cita, bloques [día, inicio, fin]]
export const DEMO_DOCTORS = [
  ['staff-doctor', 'Medicina general', 'RM 10234', 'Sede Chapinero - Cra. 13 # 54-20', 20,
    [[1, '07:00', '12:00'], [1, '14:00', '17:00'], [2, '07:00', '12:00'], [3, '07:00', '12:00'], [3, '14:00', '17:00'], [4, '07:00', '12:00'], [5, '07:00', '12:00']]],
  ['doc-pediatria', 'Pediatría', 'RM 20871', 'Sede Suba - Av. Suba # 115-40', 20,
    [[1, '08:00', '12:00'], [3, '08:00', '12:00'], [5, '08:00', '12:00']]],
  ['doc-interna', 'Medicina interna', 'RM 31456', 'Sede Chapinero - Cra. 13 # 54-20', 30,
    [[2, '13:00', '18:00'], [4, '13:00', '18:00']]],
  ['doc-odontologia', 'Odontología', 'RO 4521', 'Sede Kennedy - Av. 1 de Mayo # 70-15', 30,
    [[1, '08:00', '13:00'], [2, '08:00', '13:00'], [3, '08:00', '13:00'], [4, '08:00', '13:00'], [5, '08:00', '13:00'], [6, '08:00', '12:00']]],
  ['doc-psicologia', 'Psicología', 'TP 118802', 'Teleconsulta / Sede Chapinero', 45,
    [[1, '09:00', '12:00'], [1, '14:00', '17:00'], [2, '09:00', '12:00'], [3, '14:00', '17:00'], [4, '09:00', '12:00']]],
  ['doc-laboratorio', 'Laboratorio clínico', 'TP-B 5520', 'Laboratorio Sede Chapinero - Toma de muestras', 15,
    [[1, '06:00', '10:00'], [2, '06:00', '10:00'], [3, '06:00', '10:00'], [4, '06:00', '10:00'], [5, '06:00', '10:00'], [6, '07:00', '10:00']]],
  ['user-002', 'Medicina general', 'RM 45120', 'Sede Suba - Av. Suba # 115-40', 20,
    [[2, '14:00', '18:00'], [4, '14:00', '18:00'], [6, '08:00', '12:00']]],
  ['doc-general-2', 'Medicina general', 'RM 50877', 'Sede Chapinero - Cra. 13 # 54-20', 20,
    [[1, '07:00', '12:00'], [2, '07:00', '12:00'], [3, '07:00', '12:00'], [4, '07:00', '12:00'], [5, '07:00', '12:00']]],
];
