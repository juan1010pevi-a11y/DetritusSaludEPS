# Seguridad aplicada · Detritus Salud EPS

La seguridad se organiza en **defensa en profundidad**: seis capas (cliente, perímetro, API Gateway, identidad y acceso, microservicios, datos) más controles transversales (secretos, auditoría, DevSecOps). Todo se implementó con módulos nativos de Node (`node:crypto`), sin agregar dependencias nuevas al backend.

## Dónde está cada control

| Capa | Control | Archivo |
|---|---|---|
| Transversal | Secretos obligatorios en producción; en desarrollo se generan solos en `data/db/.dev-secrets.json` | `backend/src/security/secrets.js`, `npm run generar-secretos` |
| Identidad | Contraseñas con **scrypt** (N=2^17); los hashes PBKDF2 antiguos se actualizan al ingresar; nunca se acepta texto plano | `backend/src/security/passwords.js` |
| Identidad | **JWT HS256** de 15 min (iss, aud, exp, jti) + **refresh token** de 8 h en cookie `HttpOnly; SameSite=Strict`, rotado en cada uso; reusar uno viejo cierra todas las sesiones de esa familia | `backend/src/security/tokens.js`, `backend/src/auth.js`, `backend/src/auth-service.js` |
| Identidad | **Verificación en dos pasos (TOTP, RFC 6238)** para médico y administrador; obligatoria con `MFA_REQUIRED_FOR_STAFF=1` | `backend/src/security/totp.js`, Portal → *Seguridad de la cuenta* |
| Identidad | Cambiar la contraseña o activar 2 pasos cierra las demás sesiones; bloqueo tras 5 intentos fallidos | `backend/src/auth-service.js` |
| Autorización | Roles (RBAC) + **dueño del recurso**: el perfil completo ya no es público; el médico solo ve historias de sus pacientes; solo el administrador lista fórmulas y resultados sin número | `backend/src/auth.js` (`requireOwnerOrRole`), `users-service.js`, `meds-labs-service.js` |
| Gateway | Cabeceras de seguridad (CSP, X-Frame-Options, nosniff, Referrer-Policy, no-store), CORS por lista blanca con credenciales, `X-Request-Id`, timeouts contra Slowloris, bloqueo de `/internal` (también codificado) | `backend/src/gateway.js`, `backend/src/security/headers.js` |
| Gateway | **Límite de peticiones** por IP: general 300/min, ingreso 20/min, consultas públicas 30/min (configurables) | `backend/src/security/rate-limit.js` |
| Gateway | **CAPTCHA** invisible (hCaptcha) en consultas públicas, registro y PQRSD, si se definen `VITE_HCAPTCHA_SITEKEY` y `CAPTCHA_SECRET` | `backend/src/security/captcha.js`, `src/lib/captcha.js` |
| Microservicios | **Token de servicio** por llamada interna (JWT de 60 s, audiencia = servicio destino), en lugar de una llave fija compartida | `backend/src/internal.js` |
| Microservicios | Validación de entradas: solo JSON, sin claves `__proto__`/`constructor`, profundidad máxima, esquemas en el servicio de autenticación; errores internos sin detalles técnicos | `backend/src/service.js`, `backend/src/security/schema.js` |
| Eventos | RabbitMQ con usuario propio; los eventos no llevan datos clínicos y el código de recuperación viaja cifrado | `backend/src/broker.js`, `docker-compose.yml` |
| Datos | **Cifrado AES-256-GCM** en reposo: historia clínica, antecedentes, diagnósticos, resultados de laboratorio, indicaciones de fórmulas, dirección, ingreso y grupo SISBÉN. Las bases existentes se cifran solas al arrancar | `backend/src/security/crypto-fields.js`, `backend/src/database.js` |
| Datos | **Auditoría** de cada consulta o modificación de historia clínica, fórmulas y resultados (quién, cuándo, IP, permitido/denegado). Consulta: Consola del administrador → *Accesos a historias clínicas* | `backend/src/security/audit.js`, `GET /api/healthcare/audit`, `GET /api/meds-labs/audit` |
| Datos | Identificadores públicos (radicados, fórmulas, órdenes, autorizaciones) con números aleatorios criptográficos | `crypto.randomInt` en los servicios |
| Cliente | Token de acceso solo en memoria (no en `localStorage`), renovación automática con la cookie, cuentas demo ocultas en producción | `src/services/api.js`, `src/context/AuthContext.jsx` |
| Cumplimiento | Política de Tratamiento de Datos (Ley 1581 de 2012) y autorización obligatoria con fecha y versión en registro y afiliación; la consulta pública de afiliación ya no muestra nombres | `src/pages/Legal/PoliticaDatos.jsx`, `users-service.js` |
| Despliegue | Nginx con **HTTPS** (TLS 1.2/1.3, HSTS, CSP), frontend compilado; solo Nginx publica puertos; red Docker `internal` sin salida a internet; contenedores propios sin root, de solo lectura y sin capacidades | `Dockerfile`, `nginx/default.conf`, `backend/Dockerfile`, `docker-compose.yml` |
| DevSecOps | CI: Gitleaks (secretos), `npm audit`, verificación de archivos sensibles, Trivy (imágenes); CodeQL (SAST); OWASP ZAP (DAST, manual); Dependabot | `.github/workflows/`, `.github/dependabot.yml` |

## Cómo usarlo

**Desarrollo (`npm start` + `npm run dev`)**: no hay que configurar nada. Los secretos se generan en `backend/data/db/.dev-secrets.json` (carpeta ignorada por Git). Tu `backend/.env` con el correo se sigue usando igual.

**Docker**:

```bash
cd backend && npm run generar-secretos   # copia la salida en un archivo .env en la raíz
cd .. && docker compose up --build
# Abre https://localhost:8443 (acepta el certificado autofirmado)
```

Si se pierde `DATA_KEY`, los datos cifrados no se pueden recuperar: guárdala en un lugar seguro.

**Verificación en dos pasos**: ingresa como médico o administrador → Portal → *Seguridad de la cuenta* → *Activar*. Agrega la clave en Google Authenticator (o similar) y escribe el código. Desde ese momento el ingreso pide el código.

**Pruebas de seguridad**: `cd backend && npm test` (incluye `test/security.test.js`).

## Variables de seguridad

| Variable | Para qué | Valor por defecto |
|---|---|---|
| `AUTH_SECRET`, `INTERNAL_KEY`, `DATA_KEY` | Firmar sesiones, firmar llamadas internas, cifrar datos | Obligatorias en producción |
| `NODE_ENV=production` | Exige secretos, cookie `Secure`, oculta el código de recuperación de prueba, CORS estricto | — |
| `SEED_DEMO` | Crear cuentas de demostración en producción | `1` en Docker |
| `MFA_REQUIRED_FOR_STAFF` | Exigir 2 pasos a médico y administrador | `0` |
| `ACCESS_TOKEN_MINUTES` / `REFRESH_TOKEN_HOURS` | Duración de la sesión | 15 / 8 |
| `RATE_LIMIT_GENERAL` / `RATE_LIMIT_AUTH` / `RATE_LIMIT_PUBLIC_LOOKUP` | Peticiones por minuto por IP | 300 / 20 / 30 |
| `ALLOWED_ORIGINS` | Orígenes que pueden usar la API | `https://localhost:8443` en Docker |
| `CAPTCHA_SECRET`, `VITE_HCAPTCHA_SITEKEY` | Activar el CAPTCHA | vacío (apagado) |
| `PASSWORD_HASH_COST` | Costo de scrypt (log2 N) | 17 |

## Pendientes fuera del alcance académico

- Migrar SQLite a PostgreSQL con un usuario por servicio y TLS, y copias de respaldo cifradas automáticas.
- Guardar los secretos en un gestor (Docker secrets, Vault o el de la nube) en lugar de un archivo `.env`.
- TLS entre microservicios (mTLS) si se despliegan en máquinas distintas.
- Limitador de peticiones compartido (Redis) si hay varias réplicas del gateway.
