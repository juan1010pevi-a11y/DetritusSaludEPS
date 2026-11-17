# 6. Documentación técnica · Especificación de la API

Manual del programador para quien vaya a mantener, ampliar o crear un proyecto derivado.

## 6.1 Convenciones

- **URL base:** `/api` (en desarrollo `http://localhost:4000/api`; en Docker `https://localhost:8443/api`; publicado `https://<sitio>/api`).
- **Enrutamiento:** `/api/<servicio>/<ruta>` → el gateway reenvía `<ruta>` al microservicio. Ejemplo: `GET /api/healthcare/specialties` → healthcare `GET /specialties`.
- **Formato:** JSON en UTF-8. Toda petición con cuerpo debe llevar `Content-Type: application/json` (si no, `415`). Cuerpo máximo 1 MB, profundidad máxima 8, se descartan claves `__proto__`/`constructor`.
- **Autenticación:** `Authorization: Bearer <token>` (JWT HS256, 15 min, emitido por `POST /api/auth/login`). La sesión se renueva con `POST /api/auth/refresh`, que usa la cookie HttpOnly `detritus_rt` (ruta `/api/auth`, `SameSite=Strict`) (el navegador la envía sola con `credentials: 'include'`).
- **Perfiles:** el token lleva el perfil activo (`affiliate`, `doctor`, `administrator`). Cambiarlo: `POST /api/auth/switch-role`.
- **Trazabilidad:** cada respuesta trae `X-Request-Id`; el mismo id aparece en los registros de todos los servicios.

### Códigos de respuesta

| Código | Significado en este sistema |
|---|---|
| 200 / 201 | Correcto / creado |
| 400 | Datos inválidos (el campo `error` explica cuál) |
| 401 | Sin sesión o token vencido/alterado → renovar con `/auth/refresh` |
| 403 | Perfil sin permiso, recurso de otra persona u origen no autorizado |
| 404 | No existe (o ruta interna pedida desde afuera) |
| 409 | Conflicto: cruce de horario, cupo ocupado, estado no permitido |
| 413 / 415 | Cuerpo demasiado grande / no es JSON |
| 429 | Demasiadas peticiones (cabecera `Retry-After`) |
| **503** | **El microservicio de esa sección está apagado.** Cuerpo: `{ "error": "...", "service": "pqrs", "unavailable": true }` con `Retry-After: 30`. Las demás rutas siguen funcionando. |

### Ejemplo

```bash
# 1. Iniciar sesión
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"document":"123456789","password":"demo123","role":"affiliate"}'
# → { "token": "eyJ...", "user": { "id": "user-001", "name": "...", "role": "affiliate", ... } }

# 2. Consultar mis citas
curl -s http://localhost:4000/api/healthcare/appointments/mine -H "Authorization: Bearer eyJ..."
# → { "items": [ { "id": "...", "date": "2026-11-03", "time": "08:20", "specialty": "Medicina general", "status": "confirmed", ... } ] }
```

## 6.2 Rutas del API Gateway

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/ping` | Público | El gateway está vivo (lo usa la nube como *health check*) |
| GET | `/api/health` | Público | Estado de cada microservicio: `200` si todos están `ok`, `503` con `status: "degradado"` y la lista `down` si alguno está apagado. Con la cabecera `x-internal-key` agrega el nombre de cada base. |
| GET | `/api/admin/services` | Administrador | Estado, puerto, impacto y modo de control (`supervisor` o `docker`) de cada microservicio |
| POST | `/api/admin/services/{nombre}/stop` | Administrador | Apaga el microservicio (solo con el supervisor, `npm start`). Se vuelve a encender solo tras `AUTO_RECOVER_MINUTES` (10 por defecto). |
| POST | `/api/admin/services/{nombre}/start` | Administrador | Lo vuelve a encender |

## 6.3 Rutas públicas de cada microservicio

Acceso: **Público** = sin sesión · **Sesión** = cualquier perfil autenticado · **Dueño** = solo el titular del recurso (o el administrador) · o el perfil indicado.

### auth (`/api/auth`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/login` | Público (20/min por IP) | Documento, contraseña y perfil → token + cookie. Si el perfil tiene 2 pasos devuelve `mfaToken`. Bloqueo tras 5 intentos fallidos. |
| POST | `/mfa/verify` | Público | `mfaToken` + código de 6 dígitos → token |
| POST | `/refresh` | Cookie | Nuevo token; rota la cookie. Reusar una cookie vieja cierra todas las sesiones de esa familia. |
| POST | `/logout` | Cookie | Revoca la sesión |
| POST | `/switch-role` | Sesión | Cambia el perfil activo |
| GET | `/me` | Sesión | Datos de la sesión |
| GET | `/sessions` | Sesión | Sesiones abiertas del usuario |
| GET · POST | `/mfa/status` · `/mfa/setup` · `/mfa/enable` · `/mfa/disable` | Sesión | Verificación en dos pasos (TOTP) |
| POST | `/password/forgot` · `/password/reset` | Público | Código de 6 dígitos al correo/celular y cambio de contraseña |

### users (`/api/users`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/register` | Público + CAPTCHA | Crear cuenta (exige `acceptDataPolicy`) |
| POST | `/affiliations` | Público + CAPTCHA | Solicitud de afiliación |
| GET | `/affiliation-status?document=` | Público (30/min) | Estado de afiliación sin revelar nombre ni beneficiarios |
| GET · PATCH | `/profile` | Dueño | Ver/actualizar datos de contacto |
| GET | `/staff/overview` · `/staff/users` · `/staff/lookup` | Administrador | Indicadores, usuarios por perfil, búsqueda por documento |
| PUT | `/staff/roles` | Administrador | Asignar perfiles |
| POST | `/staff/doctors` | Administrador | Crear médico (y su ficha en healthcare) |
| GET | `/affiliates/demo` | Público (solo si `SEED_DEMO=1`) | Afiliado de demostración |

### content (`/api/content`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/news` | Público | Noticias |
| POST · PATCH | `/news` | Administrador | Crear/editar noticia |

### healthcare (`/api/healthcare`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/specialties` · `/doctors` · `/availability` | Público | Especialidades, médicos y cupos libres (sin cruces) |
| GET | `/appointments/mine` | Sesión | Mis citas (afiliado) |
| GET | `/appointments` | Administrador | Agenda general |
| POST | `/appointments` | Afiliado, administrador | Agendar (valida horario, cruces, 20 min entre citas del médico, 30 min de traslado) |
| POST | `/appointments/reschedule` | Afiliado, administrador | Reprogramar |
| PATCH | `/appointments` | Sesión (según perfil) | Cancelar, no asistió, muestra tomada |
| POST | `/appointments/attend` | Médico | Atender: evolución, CIE-10, fórmulas, órdenes y autorizaciones |
| GET · PUT | `/doctor/schedule` | Médico, administrador | Horario semanal |
| GET | `/doctor/agenda` | Médico, administrador | Agenda del médico |
| GET · POST · PATCH | `/doctor/absences` | Médico, administrador | Incapacidades y novedades (reasigna citas) |
| GET | `/doctors/admin` | Administrador | Médicos con horario y novedades |
| GET | `/clinical-history?patientId=` | Médico tratante | Historia clínica (queda en auditoría) |
| GET | `/clinical-history/mine` | Afiliado | Mi historia clínica |
| PUT | `/clinical-history/background` | Médico | Antecedentes |
| GET | `/authorizations/catalog` | Público | Servicios autorizables |
| GET | `/authorizations?document=&number=` | Público (30/min) | Consultar una autorización con documento y número |
| GET | `/authorizations/mine` | Sesión | Mis autorizaciones |
| GET · PATCH | `/authorizations/queue` · `/authorizations` | Administrador | Auditar (aprobar/negar con motivo) |
| POST | `/authorizations` | Afiliado, administrador | Solicitar autorización (el médico las genera al atender la cita) |
| GET | `/audit` | Administrador | Accesos a historias clínicas |

### pqrs (`/api/pqrs`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/requests` | Público + CAPTCHA | Radicar PQRSD (plazo legal en días hábiles) |
| GET | `/requests?id=&document=` | Público (30/min) | Consultar estado con radicado y documento |
| GET | `/requests/mine` | Sesión | Mis PQRSD |
| GET · PATCH | `/requests/queue` · `/requests` | Administrador | Bandeja y respuesta con historial |

### meds-labs (`/api/meds-labs`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/catalog` | Público | Catálogo de medicamentos y exámenes |
| GET | `/prescriptions` · `/lab-results` | Público con documento + número; listado completo solo administrador | Consultar fórmula o resultado |
| GET | `/prescriptions/mine` · `/lab-results/mine` | Sesión | Mis fórmulas y resultados |
| POST | `/prescriptions` | Médico | Emitir fórmula |
| GET · PATCH | `/prescriptions/queue` · `/prescriptions` | Administrador | Farmacia: despacho |
| GET | `/lab-results/worklist` | Médico (laboratorio) | Órdenes pendientes |
| PUT | `/lab-results/document` | Médico (laboratorio) | Registrar resultado |
| GET | `/audit` | Administrador | Accesos a fórmulas y resultados |

### notifications (`/api/notifications`)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/notifications/mine` | Sesión | Mi bandeja |
| GET · POST | `/notifications` | Administrador | Todas las notificaciones / envío manual |

## 6.4 Rutas internas (entre microservicios)

No son accesibles desde el navegador: el gateway responde `404` a cualquier `/internal` (también codificado). Exigen la cabecera `x-service-token`: un JWT de 60 s firmado con `INTERNAL_KEY` cuya audiencia es el servicio destino.

| Servicio | Rutas |
|---|---|
| users | `GET /internal/people?ids=|document=|role=`, `POST /internal/credentials/verify`, `POST /internal/password` |
| healthcare | `GET·POST /internal/doctors`, `GET /internal/appointments`, `GET /internal/stats` |
| meds-labs | `POST /internal/lab-orders`, `.../sample-taken`, `.../cancel`, `.../reschedule`, `GET /internal/appointment-links`, `GET /internal/patient-summary`, `GET /internal/stats` |
| notifications | `POST /internal/events` (respaldo HTTP del bus), `GET /health/rabbitmq` |
| pqrs | `GET /internal/stats` |

Para llamarlas desde código usa `callService(servicio, ruta, opciones)` de `backend/src/internal.js`: firma el token, aplica timeout de 5 s y cortacircuitos, y devuelve la última copia conocida de personas/médicos si users no responde.

## 6.5 Eventos (RabbitMQ `detritus.events`)

Formato: `{ "type": "appointment.created", "payload": { ... }, "createdAt": "ISO" }`. Los publica `publishEvent(tipo, datos)` de `broker.js`, que elimina antes los campos clínicos y secretos. Publican: auth (recuperación de contraseña), users (registro, afiliación, roles), healthcare (citas, reasignaciones, autorizaciones), meds-labs (fórmulas y resultados), pqrs (radicación y respuestas). Consume: notifications.

## 6.6 Cómo agregar un microservicio nuevo

1. Agrega su nombre en `SERVICE_ORDER` y su etiqueta en `SERVICE_LABELS` (`backend/src/config.js`). El puerto será `BASE_PORT + posición`.
2. Crea `backend/src/<nombre>-service.js` con `startService({ name, serviceKey, routes })` y una ruta `GET /health`.
3. Crea `backend/data/schemas/<nombre>.sql` y ábrelo con `database.js`.
4. Regístralo en `FILES` de `start-all.js`, en `SERVICES` de `test/helpers.js`, como contenedor en `docker-compose.yml` (con su volumen y *healthcheck*) y en `IMPACT` de `gateway.js`.
5. Escribe sus pruebas en `backend/test/`.
