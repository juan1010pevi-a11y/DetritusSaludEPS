# 7. Seguridad para un sitio en producción

Este documento explica **cómo** se integró la seguridad en cada fase del ciclo de vida (SDLC), qué controles automáticos corren en cada cambio y cómo se fortaleció (*hardening*) cada capa. El inventario detallado de controles, archivo por archivo, está en [`SEGURIDAD.md`](../SEGURIDAD.md).

## 7.1 Modelos de desarrollo seguro (SSDLC) y cómo se aplican

Existen varios modelos que guían a los desarrolladores para que la ciberseguridad sea parte de cada fase. El proyecto toma prácticas concretas de cada uno:

| Modelo | En qué consiste | Qué se tomó en Detritus Salud |
|---|---|---|
| **CLASP** · Seguridad en Aplicación Completo y Ligero (OWASP) | Actividades de seguridad repartidas por **roles** (arquitecto, diseñador, implementador, auditor) a lo largo del proyecto | Cada rol del equipo tiene tareas: el arquitecto definió *Database per Service* y redes aisladas; el implementador usa los módulos de `backend/src/security/`; el auditor revisa la auditoría de accesos clínicos y los reportes de CodeQL/ZAP. |
| **SSDF** · Marco de Desarrollo de Software Seguro (NIST SP 800-218) | Cuatro grupos de prácticas: **PO** preparar la organización, **PS** proteger el software, **PW** producir software bien asegurado, **RV** responder a vulnerabilidades | **PO:** política de bloqueo (7.3). **PS:** secretos fuera del repositorio, Gitleaks, Dependabot, archivos sensibles prohibidos en Git. **PW:** validación compartida navegador/servidor, pruebas de seguridad, CodeQL. **RV:** plazos por severidad, excepciones con dueño. |
| **S-SDLC** · Ciclo de Vida de Desarrollo de Software Seguro | Agregar una actividad de seguridad a cada fase clásica (requisitos, diseño, desarrollo, pruebas, despliegue, mantenimiento) | Ver tabla 7.1.1. |
| **Microsoft SDL** · Ciclo de Vida de Desarrollo de Seguridad | Prácticas obligatorias: requisitos de seguridad, **modelado de amenazas**, herramientas aprobadas, análisis estático y dinámico, plan de respuesta a incidentes | Modelado de amenazas STRIDE (7.1.2), análisis estático (CodeQL) y dinámico (OWASP ZAP), herramientas fijadas por versión en el pipeline. |
| **BSIMM** · Modelo de Construcción de Seguridad en Madurez | Modelo **descriptivo** que mide qué tan madura es la seguridad en 4 dominios: Gobierno, Inteligencia, Puntos de contacto del SSDL y Despliegue | Autoevaluación (7.1.3) para saber dónde está el proyecto y qué sigue. |

### 7.1.1 Seguridad en cada fase (S-SDLC)

| Fase | Actividad de seguridad en el proyecto |
|---|---|
| Requisitos | Requisitos de seguridad y privacidad (Ley 1581/2012, RG-05/RG-06, RNF-03/RNF-04); datos clínicos clasificados como sensibles |
| Diseño | Modelado de amenazas STRIDE; defensa en profundidad en 6 capas; *Zero Trust* entre microservicios (token por llamada) |
| Desarrollo | Módulos de seguridad propios con `node:crypto` (sin dependencias extra); validaciones compartidas; errores sin detalles técnicos |
| Pruebas | `security.test.js` (24 pruebas) y `resilience.test.js`; CodeQL (SAST); OWASP ZAP (DAST) |
| Despliegue | HTTPS, contenedores sin root y de solo lectura, redes aisladas, secretos generados por la plataforma (Render) |
| Mantenimiento | Dependabot semanal, `npm audit`, Trivy, auditoría de accesos, rotación de secretos |

### 7.1.2 Modelado de amenazas (STRIDE)

| Amenaza | Ejemplo en una EPS | Mitigación |
|---|---|---|
| **S**uplantación | Robar la sesión de un médico | JWT de 15 min, refresh token HttpOnly rotado, 2 pasos (TOTP), bloqueo por intentos |
| **T**ampering (alteración) | Modificar un token para cambiar de perfil | Firma HS256 verificada (rechaza `alg: none`, otra audiencia, vencido); token de servicio por llamada interna |
| **R**epudio | Un usuario niega haber consultado una historia clínica | Auditoría de cada acceso (quién, cuándo, IP, permitido/denegado) y `X-Request-Id` |
| **I**nformation disclosure | Ver la historia clínica de otra persona (IDOR) | Control por dueño del recurso, médico solo ve a sus pacientes, cifrado AES-256-GCM en reposo, eventos sin datos clínicos |
| **D**enial of service | Saturar el login o tumbar un servicio | Límite de peticiones por IP, timeouts, cortacircuitos, **tolerancia a fallos** (un servicio caído no tumba los demás) |
| **E**levation of privilege | Un afiliado usa rutas de administrador | RBAC en cada ruta, `/internal` bloqueado en el gateway, contenedores sin privilegios |

### 7.1.3 Autoevaluación BSIMM

| Dominio | Prácticas presentes | Siguiente paso |
|---|---|---|
| Gobierno | Política de bloqueo con plazos; documentación de seguridad | Indicadores (tiempo de corrección por severidad) |
| Inteligencia | Modelo de amenazas, clasificación de datos sensibles | Lista de requisitos de seguridad reutilizable |
| Puntos de contacto SSDL | Revisión de arquitectura, SAST, pruebas de seguridad | Revisión de código en pares obligatoria en *pull requests* |
| Despliegue | DAST, gestión de configuración, contenedores endurecidos | Pruebas de penetración y monitoreo centralizado |

## 7.2 Pipeline de seguridad (seguridad desplazada a la izquierda)

Cada solicitud de cambio (*pull request*) pasa por cinco puertas. Si una puerta de bloqueo falla, el cambio no se integra. Van de lo barato y rápido a lo lento y costoso.

| # | Puerta | Herramienta | Qué detecta | Archivo |
|---|---|---|---|---|
| 1 | Secretos | **Gitleaks** (todo el historial) + verificación de archivos sensibles (`.env`, `.sqlite`, `.key`, `.pem`, `.dev-secrets.json`) | Llaves en el código o en commits viejos | `.github/workflows/ci.yml` → *security* |
| 2 | Dependencias | **npm audit** (`--audit-level=high`), **Dependabot**, **Trivy** sobre las imágenes Docker | Paquetes con vulnerabilidades conocidas | `ci.yml` → *security* y *docker*, `.github/dependabot.yml` |
| 3 | Estático (SAST) | **CodeQL** | Inyección, XSS, rutas inseguras en el código | `.github/workflows/codeql.yml` |
| 4 | Pruebas | `node:test` + `fetch` contra el backend real (equivalente a Vitest + Supertest) | Que el ataque vuelva a funcionar: IDOR, token alterado, rutas internas, CORS, límite de peticiones, cifrado | `backend/test/security.test.js`, `ci.yml` → *backend* |
| 5 | Dinámico (DAST) | **OWASP ZAP** baseline contra el sistema corriendo en Docker | Configuración de la app en ejecución: cabeceras, cookies, divulgación de información | `.github/workflows/zap.yml` |

Ninguna etapa basta sola: el análisis estático no ve un IDOR (acceso a datos de otro usuario); la prueba automática sí, por eso existe la puerta 4.

**Para que las puertas bloqueen de verdad** en GitHub: *Settings → Branches → Branch protection rule* sobre `main` → marcar *Require status checks to pass* y seleccionar los trabajos *Backend · microservicios*, *Frontend · pruebas y build*, *Docker · imágenes*, *Seguridad · secretos y dependencias* y el análisis de CodeQL.

## 7.3 ¿Cuándo bloquea el pipeline?

Un pipeline que bloquea todo se desactiva; uno que no bloquea nada es decoración. Política del proyecto:

| Hallazgo | Acción | Plazo | Cómo está implementado |
|---|---|---|---|
| Secreto expuesto | **Bloquear y rotar** | Mismo día | Gitleaks falla el job. Rotar: `npm run generar-secretos` (o regenerar en Render), actualizar `.env`, reiniciar. Rotar `DATA_KEY` exige recifrar datos. |
| Crítica o alta con parche, en producción | **Bloquear** | Antes de integrar | `npm audit --audit-level=high --omit=dev` y Trivy `HIGH,CRITICAL` con `exit-code: 1` |
| Inyección con entrada del usuario (SAST) | **Bloquear** | Antes de integrar | CodeQL como verificación obligatoria en la regla de protección de rama |
| Vulnerabilidad sin parche disponible | Excepción con dueño y mitigación | Revisar cada 30 días | Trivy usa `ignore-unfixed`; se registra en la tabla de excepciones (7.3.1) |
| Hallazgo medio del escaneo dinámico | **Advertir** y abrir tarea | Siguiente sprint | ZAP con `fail_action: false`: el reporte queda en la ejecución de Actions |
| Hallazgo informativo o bajo | Registrar | Cuando haya capacidad | Reporte de ZAP / pestaña *Security* |

Los plazos son una propuesta didáctica; cada organización los fija según su riesgo.

### 7.3.1 Registro de excepciones

| Fecha | Hallazgo | Componente | Dueño | Mitigación temporal | Próxima revisión |
|---|---|---|---|---|---|
| — | Sin excepciones abiertas | — | — | — | — |

## 7.4 Hardening (fortalecimiento de sistemas)

Se requiere confianza digital dentro y fuera de la organización, por lo que cada capa (aplicación, sistema operativo, servidor, red y configuración), local o en la nube, se fortaleció así:

| Tipo de hardening | Qué se hizo | Dónde |
|---|---|---|
| **Gestión de la configuración** | Secretos obligatorios en producción (el servicio no arranca si faltan o son débiles); en desarrollo se generan solos; `.env` y bases fuera de Git y de las imágenes (`.gitignore`, `.dockerignore`); valores por defecto seguros (CORS cerrado, cuentas demo apagables); en Render los secretos los genera la plataforma | `backend/src/security/secrets.js`, `.env.example`, `render.yaml` |
| **Aplicaciones** | scrypt para contraseñas, JWT corto + refresh rotado, TOTP, RBAC + dueño del recurso, validación estricta de JSON, CSP y cabeceras, CAPTCHA opcional, cifrado AES-256-GCM, auditoría, mensajes de error sin detalles internos, cortacircuitos | `backend/src/security/`, `service.js`, `gateway.js` |
| **Sistema operativo** | Imágenes mínimas Alpine; usuario sin privilegios (`node`, `nginx-unprivileged`); sistema de archivos de solo lectura con `tmpfs` solo en `/tmp`; `cap_drop: ALL`; `no-new-privileges` | `Dockerfile`, `backend/Dockerfile`, `deploy/Dockerfile`, `docker-compose.yml` |
| **Servidor** | Nginx: `server_tokens off`, TLS 1.2/1.3, HSTS, límite de cuerpo 2 MB, `limit_req`, niega archivos ocultos y `.map`; gateway: timeouts contra Slowloris, oculta `X-Powered-By`; *healthchecks* y reinicio automático | `nginx/default.conf`, `gateway.js`, `docker-compose.yml` |
| **Red** | Solo Nginx publica puertos; red `internal` sin salida a internet para servicios, bases y RabbitMQ; solo notifications y gateway tienen salida (`egress`); `/internal` bloqueado en el gateway; tokens de servicio con audiencia (*Zero Trust*); CORS por lista blanca o mismo origen | `docker-compose.yml`, `gateway.js`, `internal.js` |

## 7.5 Seguridad en el despliegue público

- HTTPS lo pone la plataforma (Render o Cloudflare Tunnel); el gateway agrega HSTS y `upgrade-insecure-requests` cuando la petición llegó por HTTPS.
- La API solo acepta peticiones del mismo origen que la página o de `PUBLIC_URL`/`RENDER_EXTERNAL_URL`.
- Las cuentas de demostración están visibles a propósito para la evaluación. Para un uso real: `SEED_DEMO=0`, `VITE_SHOW_DEMO_ACCOUNTS=false`, `MFA_REQUIRED_FOR_STAFF=1`.
- La consola de microservicios solo la usa el perfil administrador, y un servicio apagado desde ella se reenciende solo a los 10 minutos para que nadie deje el sitio público incompleto.
