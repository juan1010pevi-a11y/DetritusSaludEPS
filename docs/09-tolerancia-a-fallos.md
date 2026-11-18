# 9. Tolerancia a fallos: apagar un microservicio y que los demás sigan funcionando

## 9.1 Por qué el sistema lo soporta

| Mecanismo | Qué hace | Dónde |
|---|---|---|
| Procesos y bases independientes | Cada microservicio es un proceso (o contenedor) con su propia base. Apagar uno no afecta la memoria, el puerto ni los datos de otro. | `backend/src/*-service.js`, `docker-compose.yml` |
| API Gateway con aislamiento de fallas | Si el servicio destino no responde, devuelve `503` **solo para esa ruta** con un mensaje claro (`unavailable: true`). Las demás rutas siguen. | `gateway.js` |
| Verificación local del token | Cada servicio valida el JWT con su llave; no necesita a auth ni a users para cada petición. | `auth.js` |
| Cortacircuitos (*circuit breaker*) | Tras 3 fallas seguidas al llamar a un servicio, deja de intentarlo 15 s y responde de inmediato, sin esperar timeouts. | `internal.js` |
| Última copia conocida (*stale-if-error*) | Si users está apagado, citas, fórmulas y notificaciones siguen mostrando nombres de personas y médicos ya consultados (hasta 30 min). | `internal.js` |
| Eventos con respaldo | Si RabbitMQ o notifications fallan, la cita/PQRS/fórmula se guarda igual; el aviso se pierde o se entrega luego, pero el trámite no falla. | `broker.js` |
| Frontend tolerante | El portal carga cada sección por separado (`Promise.allSettled`): si una falla, se muestran las demás y un aviso. Un banner global dice qué no está disponible. | `api.js`, `AffiliatePortal.jsx`, `ServiceStatusBanner.jsx` |
| Supervisor con autorrecuperación | Si un servicio se cae por un error, se levanta solo a los 3 s (máximo 5 veces por minuto). Si se apaga a propósito, queda apagado. | `start-all.js` |
| Docker | `restart: unless-stopped` + `healthcheck` en cada contenedor; `docker compose stop` apaga uno solo. | `docker-compose.yml` |
| Health check degradado | `/api/health` responde `503` con `"status": "degradado"` y la lista `down`; la nube usa `/api/ping` para no reiniciar todo el sitio por un servicio apagado. | `gateway.js`, `render.yaml` |

## 9.2 Qué deja de funcionar si se apaga cada servicio

| Servicio apagado | No funciona | Sigue funcionando |
|---|---|---|
| `auth` | Iniciar sesión, renovar la sesión, recuperar contraseña | Toda la navegación; quien ya ingresó sigue trabajando hasta que venza su token (15 min) |
| `users` | Registro, afiliación, nuevos inicios de sesión, perfil | Citas, fórmulas, PQRS, noticias (con nombres ya consultados) |
| `content` | Noticias de la página de inicio | Todo lo demás |
| `notifications` | Envío de correo/SMS/WhatsApp y bandeja | Citas, PQRS, fórmulas y demás trámites se crean igual |
| `healthcare` | Citas, horarios, historia clínica, autorizaciones | PQRS, fórmulas, resultados, noticias, registro |
| `pqrs` | Radicar y consultar PQRSD | Todo lo demás |
| `meds-labs` | Fórmulas, farmacia, resultados de laboratorio | Citas, PQRS, noticias, registro |

## 9.3 Cómo demostrarlo

### A · Desde la página (recomendado para la sustentación)

Funciona con `npm start`, `iniciar.cmd`, `publicar.cmd` y en Render.

1. Ingresa como **Administrador** (`900000002` / `admin123`).
2. Ve a **Consola administrativa → Microservicios**. Verás los 7 servicios, su puerto y qué pasa si se apagan.
3. Pulsa **Apagar** en `pqrs` y confirma.
4. Observa:
   - En todo el sitio aparece el aviso *“Servicio parcialmente disponible. En este momento no funciona: PQRSD. El resto del sitio funciona con normalidad.”*
   - *Trámites → Agendar cita*, *Afiliados → Resultados de laboratorio*, noticias: funcionan.
   - *Trámites → Radicar PQRSD*: “El servicio de PQRSD no está disponible en este momento. El resto del portal sigue funcionando.”
   - `/api/health`: `"status": "degradado"`, `"down": ["pqrs"]`.
5. Pulsa **Encender**. En un segundo todo vuelve a la normalidad, sin reiniciar nada más.

Un servicio apagado desde la página se enciende solo a los 10 minutos (`AUTO_RECOVER_MINUTES`), para que en el link público nadie lo deje apagado.

### B · Desde la terminal del backend

En la ventana donde corre `npm start` escribe:

```
estado
detener pqrs
iniciar pqrs
reiniciar healthcare
ayuda
```

Lo apagado desde la terminal **no** se vuelve a encender solo.

También se puede arrancar con servicios apagados:

```bash
# Windows (PowerShell)
$env:DISABLED_SERVICES="pqrs,content"; npm start
# macOS / Linux
DISABLED_SERVICES=pqrs,content npm start
```

### C · Con Docker Compose

```bash
docker compose stop pqrs        # apaga solo PQRS
docker compose ps               # los demás siguen "running (healthy)"
docker compose start pqrs       # lo enciende
```

En este modo la consola web muestra el estado, pero indica que se apague/encienda con estos comandos.

### D · Simular una caída por error (autorrecuperación)

Con `npm start`, termina a la fuerza el proceso de un servicio (Administrador de tareas en Windows o `kill -9 <pid>` en Linux/macOS). El supervisor escribe *“se detuvo con código … Se reinicia en 3 segundos (autorrecuperación)”* y el servicio vuelve solo.

## 9.4 Prueba automática

`backend/test/resilience.test.js` lo comprueba en cada cambio (GitHub Actions):

- Con `pqrs` apagado: PQRS responde `503` con `unavailable: true`; citas, especialidades, noticias y fórmulas responden `200`; `/api/health` indica `degradado`.
- La consola de microservicios exige perfil administrador y muestra el servicio apagado y su impacto.
- Al encender `pqrs`, vuelve a responder sin reiniciar los demás.
- Con `users`, `notifications` y `content` apagados al mismo tiempo, se puede seguir radicando una PQRSD y consultando citas con la sesión ya iniciada.
- Con el supervisor: el administrador apaga `pqrs` desde la API, el supervisor no lo reinicia solo, y lo vuelve a encender; si un servicio se mata por error, el supervisor lo levanta.

```bash
cd backend
node --test test/resilience.test.js
```
