# 2. Requerimientos del proyecto de software

## 2.1 Requisitos generales (pautas que sigue el proyecto)

| ID | Pauta |
|---|---|
| RG-01 | Arquitectura de **microservicios**: cada dominio del negocio es un proceso independiente con su propia base de datos. Ningún servicio lee la base de otro. |
| RG-02 | Toda petición del navegador entra por un **API Gateway** único (`/api/...`). Las rutas `/internal/*` solo las usan los microservicios entre sí. |
| RG-03 | Interfaz en **español**, adaptable a celular y computador, con la identidad visual de la EPS. |
| RG-04 | Las mismas reglas de validación se aplican en el navegador y en el servidor (documento solo dígitos, celular colombiano, contraseña segura, signos vitales por rango…). |
| RG-05 | **Seguridad por diseño** (ver [07-seguridad.md](07-seguridad.md)): secretos fuera del código, mínimos privilegios, datos clínicos cifrados, auditoría. |
| RG-06 | Tratamiento de datos personales conforme a la **Ley 1581 de 2012**, con autorización explícita del titular. |
| RG-07 | Todo cambio pasa por el pipeline de integración continua (pruebas + controles de seguridad) antes de integrarse. |
| RG-08 | El sistema debe seguir funcionando si un microservicio se cae (ver [09-tolerancia-a-fallos.md](09-tolerancia-a-fallos.md)). |

## 2.2 Requisitos funcionales (servicios que presta el sistema)

| ID | Requisito | Microservicio | Perfil |
|---|---|---|---|
| RF-01 | Iniciar sesión con documento, contraseña y perfil; cerrar sesión; renovar la sesión automáticamente | auth | Todos |
| RF-02 | Verificación en dos pasos (TOTP) para médico y administrador | auth | Médico, admin |
| RF-03 | Recuperar la contraseña con un código de 6 dígitos enviado al correo y al celular | auth + notifications | Todos |
| RF-04 | Registrarse en el portal y solicitar afiliación (contributivo/subsidiado) aceptando la política de datos | users | Visitante |
| RF-05 | Consultar estado de afiliación y descargar certificado | users | Visitante, afiliado |
| RF-06 | Actualizar datos de contacto del perfil | users | Afiliado |
| RF-07 | Gestionar perfiles de acceso (asignar rol de médico/administrador) y crear médicos | users + healthcare | Admin |
| RF-08 | Publicar y consultar noticias | content | Admin / todos |
| RF-09 | Definir el horario semanal de cada médico y la duración de sus citas | healthcare | Médico, admin |
| RF-10 | Consultar disponibilidad y agendar citas **sin cruces** (ni del médico ni del paciente, con 20 min entre citas del profesional y 30 min de traslado entre sedes) | healthcare | Afiliado, admin |
| RF-11 | Cancelar y reprogramar citas | healthcare | Afiliado, médico, admin |
| RF-12 | Registrar incapacidades/vacaciones del médico y reasignar o marcar “por reprogramar” sus citas | healthcare | Médico, admin |
| RF-13 | Atender la cita: signos vitales, examen físico, diagnóstico CIE-10, plan, fórmulas, órdenes y autorizaciones | healthcare + meds-labs | Médico |
| RF-14 | Consultar la historia clínica (el médico la de sus pacientes, el afiliado la propia) | healthcare | Médico, afiliado |
| RF-15 | Solicitar, auditar (aprobar/negar) y consultar autorizaciones | healthcare | Médico, admin, afiliado |
| RF-16 | Emitir fórmulas y gestionar su despacho en farmacia | meds-labs | Médico, admin |
| RF-17 | Registrar y consultar resultados de laboratorio | meds-labs | Bacteriólogo, afiliado |
| RF-18 | Radicar PQRSD (con o sin cuenta), consultar su estado y responderlas con historial | pqrs | Todos / admin |
| RF-19 | Enviar notificaciones por correo, SMS y WhatsApp de cada evento y verlas en el portal | notifications | Todos |
| RF-20 | Consultar la auditoría de accesos a historias clínicas, fórmulas y resultados | healthcare + meds-labs | Admin |
| RF-21 | Ver el estado de cada microservicio y apagarlo/encenderlo para demostrar tolerancia a fallos | API Gateway + supervisor | Admin |

## 2.3 Información de autoría y *legacy*

- **Autoría.** Proyecto original desarrollado por el equipo del proyecto integrador de Ingeniería de Sistemas y Computación de la Universidad Católica de Colombia. Repositorio: `github.com/juan1010pevi-a11y/DetritusSaludEPS`.
- **Origen.** Comenzó como un sitio institucional estático en React + Vite (páginas de Afiliados, Trámites, Atención y Nosotros). Sobre esa base se construyeron los portales, el backend de microservicios y la seguridad. No reutiliza código de sistemas de terceros.
- **Evolución (versiones).**

| Versión | Cambio principal |
|---|---|
| 0.x | Sitio institucional (solo frontend) |
| 1.0 | Microservicios con una base SQLite por servicio, API Gateway, RabbitMQ, historia clínica, notificaciones, pruebas automáticas y seguridad aplicada (ver `CAMBIOS.md`) |
| 1.1 | Tolerancia a fallos (supervisor, cortacircuitos, consola de microservicios), despliegue con link público, carpeta `docs/` |

- **Retrocompatibilidad.** Las bases existentes se migran solas al arrancar (columnas nuevas y cifrado de campos sensibles). Los hashes de contraseña PBKDF2 antiguos se actualizan a scrypt cuando el usuario ingresa. Las rutas de la API conservan sus nombres desde la versión 1.0.
- **Dependencias de terceros.** Frontend: React 18, React Router 6, Vite 5. Backend: `sql.js` (SQLite en WebAssembly) y `amqplib` (RabbitMQ). Toda la criptografía usa `node:crypto` (sin librerías adicionales).

## 2.4 Alcances y limitaciones

**Dentro del alcance**

- Los 21 requisitos funcionales anteriores, con datos de demostración (afiliados, médicos de 6 especialidades, administrador).
- Funcionamiento local (`npm start`), con Docker Compose (HTTPS, redes aisladas) y publicado en internet (Render o túnel).
- Pruebas automáticas unitarias, de integración, de seguridad y de tolerancia a fallos.

**Fuera del alcance (limitaciones)**

- No se conecta con sistemas reales del sector (ADRES, RIPS, MIPRES, historia clínica interoperable). Los datos son ficticios.
- No hay pagos en línea (copagos/cuotas moderadoras solo se informan).
- SQLite es adecuado para la demostración; para producción real se recomienda PostgreSQL con un usuario por servicio.
- En la versión publicada gratis (Render *free*) las bases se reinician en cada despliegue y el sitio “se duerme” tras 15 minutos sin visitas.
- Los SMS y WhatsApp reales requieren credenciales de Twilio; sin ellas los mensajes quedan como “Simulados” en el portal.
