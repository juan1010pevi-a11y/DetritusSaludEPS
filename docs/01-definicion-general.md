# 1. Definición general del proyecto

## Idea general (¿qué es?)

**Detritus Salud E.P.S.** es el portal web de una Entidad Promotora de Salud ficticia. Reúne en un solo sitio la información institucional de la EPS y los trámites en línea que hoy obligan a los afiliados a ir a una sede o llamar a una línea de atención:

- Consultar el estado de afiliación, descargar certificados y actualizar datos.
- Afiliarse (régimen contributivo y subsidiado) y registrarse en el portal.
- Agendar, reprogramar y cancelar citas médicas según el horario real de cada médico.
- Solicitar y consultar autorizaciones de servicios.
- Consultar fórmulas médicas, su despacho en farmacia y resultados de laboratorio.
- Radicar y hacer seguimiento a PQRSD (peticiones, quejas, reclamos, sugerencias y denuncias).
- Recibir avisos por correo, SMS y WhatsApp de cada trámite.

Además ofrece portales internos para el **médico** (agenda, atención de la cita, historia clínica, fórmulas, órdenes de laboratorio, incapacidades) y para el **administrador** (médicos y horarios, agenda general, auditoría de autorizaciones, farmacia, PQRS, perfiles de acceso, notificaciones y estado de los microservicios).

La funcionalidad principal es la **gestión de citas médicas con historia clínica**: el afiliado agenda, el médico atiende y registra la evolución, y desde la atención se generan fórmulas, órdenes de laboratorio y autorizaciones.

## Objetivos (¿para qué?)

**Objetivo general.** Construir un portal web seguro y escalable, basado en microservicios, que permita a los afiliados de una EPS realizar sus trámites de salud en línea y al personal de la EPS gestionarlos.

**Objetivos específicos**

1. Separar el sistema en microservicios independientes, cada uno con su propia base de datos (*Database per Service*), comunicados por un API Gateway, HTTP interno y un bus de eventos (RabbitMQ).
2. Garantizar que la caída de un microservicio no tumbe el sitio completo (tolerancia a fallos y degradación controlada).
3. Proteger los datos clínicos y personales según la Ley 1581 de 2012: autenticación fuerte, control de acceso por rol y por dueño, cifrado en reposo y auditoría.
4. Integrar la seguridad en todo el ciclo de vida del desarrollo con un pipeline automático (secretos, dependencias, SAST, pruebas y DAST).
5. Desplegar el sistema para que cualquier persona pueda abrirlo desde un link.

**Necesidad que cubre.** Los afiliados pierden tiempo en filas y llamadas para trámites repetitivos (certificados, citas, autorizaciones, resultados). La EPS necesita además trazabilidad de lo que hace su personal sobre datos sensibles. El portal digitaliza esos trámites y deja registro de cada acceso.

## Usuarios (¿quién?)

| Usuario | Qué hace en el sistema | Nivel de experiencia esperado |
|---|---|---|
| Visitante (sin cuenta) | Lee información, consulta IPS y requisitos, radica PQRSD, consulta estado de afiliación | Básico: sabe navegar en internet desde el celular o el computador |
| Afiliado | Agenda citas, ve su historia clínica, fórmulas, resultados, autorizaciones, notificaciones y certificados | Básico |
| Médico | Gestiona su agenda y horario, atiende citas, registra historia clínica, formula, ordena laboratorios, reporta incapacidades | Intermedio: usa sistemas de historia clínica |
| Administrador de la EPS | Gestiona médicos y horarios, perfiles de acceso, autorizaciones, farmacia, PQRS; revisa auditoría y estado de los microservicios | Intermedio-avanzado |
| Desarrollador / operador | Instala, prueba, despliega y mantiene el sistema | Avanzado: Node.js, React, Docker, Git |

Una misma persona puede tener varios perfiles (por ejemplo, una médica que también es afiliada) y elegir con cuál ingresa.

**Público de este informe.** Los documentos 1 y 2 están escritos para cualquier lector (docente, evaluador, usuario). Los documentos 3 a 9 están dirigidos a desarrolladores y operadores con conocimientos básicos de Node.js, Git y la terminal.
