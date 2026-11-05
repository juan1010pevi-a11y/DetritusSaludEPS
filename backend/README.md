# Microservicios de Detritus Salud

Este MVP separa el backend en servicios independientes y expone un API Gateway en el puerto `4000`.

## Ejecutar

Desde `backend/`, con un solo comando:

```bash
npm install
npm start      # inicia todos los servicios y el gateway; verifica en http://localhost:4000/api/health
```

O, si prefieres, una terminal por proceso:

```powershell
npm run auth
npm run users
npm run content
npm run notifications
npm run healthcare
npm run pqrs
npm run meds-labs
npm run gateway
```

En Windows también puedes usar `start-all.cmd`.

## Cuentas de prueba

El botón **Ingresar** de la barra superior abre el inicio de sesión, donde se elige el perfil (Afiliado, Médico o Administrador). En “Cuentas de prueba” la contraseña ya no se muestra: al elegir la cuenta se llena el formulario con la contraseña oculta (el ícono del ojo permite verla mientras se escribe). Al ingresar, la barra superior muestra el perfil activo con un color propio (verde afiliado, azul petróleo médico, dorado administrador) y la opción de cambiar de perfil cuando la persona tiene varios.

| Perfil | Documento | Contraseña | Notas |
|---|---|---|---|
| Afiliado | `123456789` | `demo123` | Afiliado demo |
| Médico | `900000001` | `doctor123` | Medicina general |
| Médico | `900000003` – `900000006` | `medico123` | Pediatría, Medicina interna, Odontología, Psicología |
| Médico (laboratorio) | `900000007` | `medico123` | Bact. Sandra Ruiz, registra resultados |
| Médico | `900000008` | `medico123` | Dr. Andrés Rojas, medicina general (recibe las citas reasignadas por incapacidad) |
| Afiliada **y** médica | `1010101010` | `demo123` | Laura Gómez: un documento, dos perfiles |
| Administrador | `900000002` | `admin123` | Médicos, horarios, perfiles y agenda general |

## Citas según el horario de los médicos (sin cruces)

- `dim_doctors` guarda la especialidad, sede y duración de cada cita; `doctor_schedules` las franjas semanales (día, hora inicio, hora fin).
- Cada cita guarda su duración (`duration_minutes`) y ocupa el intervalo **[hora, hora + duración)**. Dos citas se cruzan si sus intervalos se solapan, aunque empiecen a horas distintas (por ejemplo 8:20–8:40 y 8:30–9:00). La regla está en `src/scheduling.js` y tiene pruebas unitarias.
- Cada profesional necesita al menos **20 minutos entre citas**, incluso si la segunda empieza justo cuando termina la primera; disponibilidad y reserva aplican la misma regla.
- Entre citas presenciales del mismo paciente en sedes distintas se exigen al menos **30 minutos de traslado** después de terminar una cita; no aplica en la misma sede ni a teleconsultas.
- `GET /api/healthcare/availability` solo ofrece cupos que: están en el horario del médico, no se cruzan con otra cita del médico, no se cruzan con otra cita del mismo paciente (con cualquier médico), el médico no tiene incapacidad ese día y empiezan en más de 30 minutos.
- `POST /api/healthcare/appointments` vuelve a validar todo en el servidor (además del índice único `doctor_id + fecha + hora`). Si el paciente intenta una cita que se cruza recibe: “Ya tienes una cita de … a las … que se cruza con ese horario”.
- El médico gestiona su horario en *Portal médico → Mi horario*; el administrador lo hace para todos en *Consola administrativa → Médicos y horarios*.
- Para cerrar una consulta el médico usa **Atender cita** (queda en la historia clínica); las citas de laboratorio se cierran con *Muestra tomada*. El médico también puede marcar *No asistió* o *Cancelar*, y el afiliado puede cancelar o **reprogramar** sus citas futuras.

## Incapacidad del médico (y vacaciones, licencias…)

1. El médico la reporta en *Portal médico → Incapacidades y novedades* o el administrador en *Médicos y horarios → Registrar incapacidad* (`POST /api/healthcare/doctor/absences`).
2. Cada cita de esas fechas se **reasigna automáticamente** a otro médico de la misma especialidad que esté libre a la **misma hora**. El paciente ve “Reasignada de … a … por incapacidad” y recibe aviso por correo, SMS y WhatsApp.
3. Si nadie puede atenderla, la cita queda en estado **Por reprogramar**: el paciente la ve resaltada en *Mis próximas citas* con el botón **Reprogramar**, que le muestra solo cupos válidos (`POST /api/healthcare/appointments/reschedule`).
4. Mientras dure la novedad, el médico no aparece en la disponibilidad. La tabla es `doctor_absences`.

## Historia clínica

- **Antecedentes** (`clinical_backgrounds`): grupo sanguíneo, alergias, antecedentes personales, quirúrgicos y familiares, medicamentos actuales y hábitos.
- **Evoluciones** (`clinical_encounters`): una por cada cita atendida, con motivo de consulta, enfermedad actual, signos vitales (TA, FC, FR, temperatura, saturación, peso, talla e IMC), examen físico, diagnóstico con código CIE-10 y plan. Los signos vitales se validan por rango.
- Además reúne las fórmulas y los laboratorios (de meds-labs) y las órdenes de autorización.
- Quién la ve: el **médico** solo de pacientes que tiene o tuvo en su agenda (botón *Historia clínica* en la agenda y dentro de *Atender cita*, donde también puede editar antecedentes); el **afiliado** la suya en *Portal → Mi historia clínica* (puede imprimirla). El administrador no tiene acceso (reserva de la historia clínica, Resolución 1995 de 1999).
- Endpoints: `GET /api/healthcare/clinical-history?patientId=`, `GET /api/healthcare/clinical-history/mine`, `PUT /api/healthcare/clinical-history/background`.

## Contraseñas

- Se guardan con hash PBKDF2 + sal en `users.sqlite`; ninguna respuesta de la API incluye la contraseña.
- Nuevas contraseñas: mínimo 8 caracteres con letras y números (se muestra la lista de requisitos mientras se escribe).
- Tras 5 intentos fallidos en 15 minutos el documento se bloquea temporalmente (`login_attempts`).
- **¿Olvidaste tu contraseña?** (en el modal de ingreso): se escribe el documento, llega un código de 6 dígitos al correo y al celular registrados (vence en 15 minutos, máximo 5 intentos, un solo uso, se guarda con hash en `password_resets`) y se define la nueva contraseña. En modo demostración el código también se muestra en pantalla para poder probar sin correo real. Endpoints: `POST /api/auth/password/forgot` y `POST /api/auth/password/reset`.

## Validación de datos numéricos

Las reglas están en `src/lib/validators.js` (frontend) y `backend/src/validators.js` (copia idéntica; una prueba verifica que sean iguales), así el navegador y el servidor validan lo mismo:

| Dato | Regla |
|---|---|
| Número de documento | Solo dígitos, 5 a 12, sin empezar en 0 (el pasaporte admite letras). El campo borra puntos, letras y espacios mientras se escribe. |
| Celular | 10 dígitos que empiezan por 3 (acepta +57). |
| Teléfono fijo / NIT / ingresos | Solo dígitos (fijo 7–10, NIT 9–10). |
| Código de verificación | 6 dígitos. |
| Signos vitales | TA `120/80`; FC 30–220; FR 8–60; T° 34–42; SatO₂ 50–100; peso 1–350 kg; talla 30–230 cm. |
| Cantidades de medicamentos | Entero entre 1 y 360. |
| Valores de laboratorio con rango | Solo números. |
| Radicado PQRS | `PQRS-AAAA-NNNNNN`. |

## Notificaciones (correo, SMS y WhatsApp)

- Eventos que se notifican: registro, afiliación, cambio de datos, código y cambio de contraseña, cita confirmada / cancelada / atendida / inasistencia / reasignada / por reprogramar / reprogramada, solicitudes y decisiones de autorización, fórmula emitida / lista / entregada, resultado de laboratorio, PQRS radicada y cada cambio de estado (con la respuesta), e incapacidad registrada (al médico).
- Los textos están en `src/notification-templates.js`; cada evento genera un mensaje por canal en `fact_notifications`.
- Sin RabbitMQ el evento llega por HTTP a `POST /internal/events` de Notifications Service, así que funciona igual con `npm start`.
- *Portal → Notificaciones* muestra al afiliado (y al médico) lo que se le envió; el administrador ve toda la bandeja de salida en *Consola → Notificaciones enviadas*.
- Para envío real: `backend/.env` con `NOTIFICATIONS_MODE=live` y
  - Correo con Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (contraseña de aplicación). El cliente SMTP está en `src/smtp-client.js` y no necesita librerías.
  - SMS y WhatsApp con Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_FROM` (sandbox de WhatsApp).
  - Un canal sin credenciales queda como “Canal sin configurar” y los demás se envían igual.

## PQRS

- El formulario pide tipo, asunto, nombre, tipo y número de documento, correo, celular y descripción (mínimo 20 caracteres); todo se valida en el servidor.
- Radicado `PQRS-AAAA-NNNNNN` con fecha límite legal (15 días hábiles; 30 para denuncias).
- Consulta pública con **radicado + documento**; el afiliado ve las suyas en el portal.
- El administrador las gestiona en *Consola → PQRS* (En revisión → Responder → Cerrar); cada cambio queda en `pqrs_status_history` y se notifica al ciudadano aunque no sea afiliado.

## Afiliación en línea (botón "Afiliarme")

`/afiliarme` es el Formulario Único de Afiliación en 6 pasos: régimen y tipo de cotizante (dependiente, independiente, pensionado o subsidiado por SISBÉN IV), datos personales, ubicación/contacto e IPS primaria, información laboral, grupo familiar y declaraciones (multiafiliación, veracidad, Ley 1581 de 2012). `POST /api/users/affiliations` valida mayoría de edad del titular, hijos menores de 25, un solo cónyuge, padres solo sin cónyuge ni hijos, NIT, celular, SISBÉN y que nadie del grupo esté ya afiliado. Genera el radicado `AFI-AAAA-NNNNNN`, los servicios quedan activos desde el día siguiente, se inicia sesión automáticamente y los beneficiarios aparecen en el certificado.

## Médicos que también son usuarios

- **El administrador agrega médicos** en *Consola administrativa → Médicos y horarios → + Agregar médico* (`POST /api/users/staff/doctors`). Primero escribe el documento: si la persona ya existe (por ejemplo, como afiliada) se usa la misma cuenta y solo se le agrega el perfil `doctor`; si es nueva, se crea con contraseña temporal y opcionalmente también como afiliada. Después se le asigna el horario.
- **Un médico que se registra como usuario** en *Crear cuenta* con su mismo documento y su contraseña de médico queda vinculado: se le agrega el perfil `affiliate` a la misma cuenta (no se duplica la cédula). Si la contraseña no coincide, el sistema se lo indica.
- Nadie puede registrarse a sí mismo como médico: ese perfil solo lo asigna el administrador, como en una EPS real.

## Autorizaciones, medicamentos y certificado

| Trámite | Quién hace qué | Endpoints |
|---|---|---|
| Autorizaciones | El afiliado solicita (servicio, médico que ordena, n.º de orden, motivo) → el administrador aprueba o niega en *Consola → Autorizaciones* → al aprobar se genera `AUT-AAAA-NNNNNN`, prestador y vigencia de 90 días. | `POST/PATCH /api/healthcare/authorizations`, `GET .../mine`, `GET .../queue`, `GET .../catalog` |
| Atención de la cita | El médico pulsa **Atender cita** (habilitado desde el día de la cita): registra diagnóstico y evolución, formula medicamentos y emite órdenes que requieren autorización; al finalizar la cita queda *Atendida* y su resultado se ve en la agenda y en el historial del afiliado. | `POST /api/healthcare/appointments/attend` |
| Medicamentos | El médico formula desde **Atender cita** (o **+ Fórmula adicional**) → la fórmula `FAR-AAAA-NNNNNN` llega a *Consola → Farmacia* → se alista con punto de entrega → se registra la entrega. | `POST/PATCH /api/meds-labs/prescriptions`, `GET .../mine`, `GET .../queue`, `GET /api/meds-labs/catalog` |
| Certificado | El afiliado lo genera con su sesión (datos reales, código de verificación, vigencia 30 días) y lo imprime o guarda en PDF. | `GET /api/users/profile` |

En el portal del afiliado estos trámites están en las pestañas *Autorizaciones*, *Medicamentos* y *Certificado de afiliación*. Las páginas públicas también permiten consultarlos (documento + número de autorización o de fórmula).

## Laboratorio: de la cita al documento de resultados

1. El afiliado agenda *Laboratorio clínico* eligiendo el examen → se crea la orden `LAB-AAAA-NNNNNN` (estado *Muestra pendiente*).
2. El día de la cita, el laboratorio pulsa **Muestra tomada** → se crea el documento de resultados con todos los parámetros del examen (estado *En análisis*).
3. En *Resultados de laboratorio* el bacteriólogo diligencia los valores (los fuera de rango se marcan Alto/Bajo automáticamente) y pulsa **Validar y publicar**.
4. El afiliado lo ve en *Resultados de laboratorio* (con su sesión o con documento + número de orden) y puede imprimirlo o guardarlo en PDF.

Endpoints: `GET /api/meds-labs/lab-results/mine`, `GET /api/meds-labs/lab-results/worklist`, `PUT /api/meds-labs/lab-results/document`.

Para empezar de cero, borra la carpeta `data/db` (cada servicio vuelve a crear su base con los datos de demostración).

Rutas de prueba:

- `GET http://localhost:4000/api/content/news`
- `GET http://localhost:4000/api/users/affiliates/demo`
- `POST http://localhost:4000/api/auth/login`
- `POST http://localhost:4000/api/healthcare/appointments`
- `POST http://localhost:4000/api/pqrs/requests`
- `POST http://localhost:4000/api/auth/password/forgot`
- `POST http://localhost:4000/api/healthcare/doctor/absences`
- `GET http://localhost:4000/api/healthcare/clinical-history/mine`
- `GET http://localhost:4000/api/notifications/notifications/mine`

RabbitMQ y los servicios se inician con `docker compose up --build` desde la raíz. Cada microservicio guarda su base en su propio volumen Docker (`auth-db`, `users-db`, `healthcare-db`, `pqrs-db`, `meds-labs-db`, `notifications-db`, `content-db`).

## Persistencia: una base de datos por microservicio

Cada servicio llama a `createDatabase('<servicio>')` (`src/database.js`), que abre `data/db/<servicio>.sqlite` y ejecuta `data/schemas/<servicio>.sql`. Ningún servicio abre el archivo de otro.

| Servicio | Base | Le pide datos a… (HTTP interno) |
|---|---|---|
| auth | `auth.sqlite` | users (validar credenciales, cambiar contraseña), healthcare (especialidad del médico) |
| users | `users.sqlite` | healthcare (crear ficha del médico), healthcare/pqrs/meds-labs (contadores del panel) |
| content | `content.sqlite` | — |
| notifications | `notifications.sqlite` | users (correo y celular del destinatario) |
| healthcare | `healthcare.sqlite` | users (nombres, documento, perfiles), meds-labs (órdenes de laboratorio, fórmulas) |
| pqrs | `pqrs.sqlite` | users (saber si quien radica es afiliado) |
| meds-labs | `meds-labs.sqlite` | users (nombres), healthcare (validar la cita antes de formular) |

- Las rutas `/internal/*` solo las usan los microservicios entre sí: llevan la cabecera `x-internal-key` (`INTERNAL_KEY`) y el API Gateway responde 404 si alguien las pide desde el navegador.
- Los cambios de varias tablas se hacen en transacción (`db.transaction`), para no dejar datos a medias.
- Si tenías la base anterior compartida `data/detritus.sqlite`, ya no se usa: puedes borrarla.

## Pruebas

```bash
npm test
```

- `test/unit.test.js`: validaciones, cruce de horarios, plazos de PQRS, plantillas de notificación, hash de contraseñas y cliente SMTP (contra un servidor SMTP falso).
- `test/integration.test.js`: levanta los 7 microservicios + gateway en puertos 5600–5607 con bases temporales y recorre los flujos completos (bases separadas, login y bloqueo, registro con validaciones, citas sin cruces, incapacidad con reasignación y reprogramación, historia clínica, fórmulas, laboratorio, PQRS, notificaciones y recuperación de contraseña).
- La variable `FAKE_NOW=2026-11-02T06:00` fija la fecha de las pruebas para que no dependan del día en que se ejecuten.
