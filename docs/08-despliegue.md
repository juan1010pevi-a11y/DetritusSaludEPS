# 8. Despliegue: publicar la página y compartir el link

Objetivo: que otra persona abra un link desde su navegador (computador o celular), ingrese con una cuenta de prueba y use el sistema completo.

Hay tres formas. Para la entrega se recomienda la **opción 1** (link permanente).

| | Opción 1 · Render | Opción 2 · Túnel desde tu PC | Opción 3 · Docker Compose |
|---|---|---|---|
| Link | `https://detritus-salud-eps.onrender.com` (fijo) | `https://xxxx.trycloudflare.com` (cambia cada vez) | `https://localhost:8443` (solo tu equipo o tu red) |
| Costo | Gratis | Gratis, sin cuenta | Gratis |
| ¿Tu PC debe estar prendido? | No | Sí | Sí |
| Tiempo | ~15 min la primera vez | ~3 min | ~10 min |
| Ideal para | Entregar el link al profesor | Mostrar en clase ya mismo | Demostrar la arquitectura completa (Nginx, RabbitMQ, un contenedor por servicio) |

En las opciones 1 y 2 se usa la **imagen todo-en-uno**: los 7 microservicios y el gateway corren en un mismo contenedor bajo el supervisor (`start-all.js`), y el gateway sirve también la página. Siguen siendo procesos independientes con bases independientes: se pueden apagar uno por uno desde la consola del administrador.

---

## Opción 1 · Render (link permanente)

### Requisitos

- El proyecto subido a GitHub (incluidos `render.yaml` y `deploy/Dockerfile`).
- Una cuenta gratuita en https://render.com (se puede entrar con la cuenta de GitHub).

### Pasos

1. **Sube los cambios** a GitHub:

   ```bash
   git add .
   git commit -m "Despliegue, tolerancia a fallos y documentación"
   git push
   ```

2. En Render: **New + → Blueprint**.
3. Conecta GitHub y elige el repositorio **DetritusSaludEPS**. Render lee `render.yaml` y muestra el servicio `detritus-salud-eps`.
4. Pulsa **Apply / Deploy Blueprint**. Render:
   - genera solos `AUTH_SECRET`, `INTERNAL_KEY` y `DATA_KEY` (no quedan en GitHub);
   - construye `deploy/Dockerfile` (compila React e instala el backend);
   - arranca el supervisor y revisa `/api/ping`.
5. Cuando el estado diga **Live**, copia el link de arriba (`https://detritus-salud-eps.onrender.com` o similar). Ese es el link que compartes.
6. Comprueba: abre `https://<tu-link>/api/health` → todos en `"ok"`.

> Si el repositorio es de otra persona del grupo (por ejemplo, el dueño del repo), ella debe hacer los pasos 2–4 con su cuenta, o darte permisos de colaborador.

### Qué saber de la versión gratuita

- **Se duerme** tras unos 15 minutos sin visitas. La primera visita después tarda ~1 minuto en despertar. Abre el link unos minutos antes de la sustentación.
- **Las bases se reinician** en cada despliegue o reinicio (el disco es temporal). Siempre vuelven las cuentas de prueba (`SEED_DEMO=1`). Para datos permanentes se necesita un disco persistente (plan pago) o una base externa.
- Sin RabbitMQ: los eventos llegan a notifications por HTTP (respaldo incluido en `broker.js`). Sin credenciales, las notificaciones quedan como “Simuladas” en el portal. Para correo real agrega en *Environment* las variables de `backend/.env.example` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` o `RESEND_API_KEY`).
- Cada `git push` a `main` vuelve a desplegar solo (`autoDeploy: true`).

---

## Opción 2 · Túnel desde tu computador (link inmediato)

Usa **Cloudflare Tunnel** en modo rápido: no requiere cuenta ni abrir puertos del router.

### Windows

1. Doble clic en **`publicar.cmd`** (raíz del proyecto).
   - La primera vez instala `cloudflared` con `winget`. Cierra y vuelve a abrir `publicar.cmd`.
2. El script compila la página, abre el backend en otra ventana (sirviendo la página en `http://localhost:4000`) y crea el túnel.
3. En la ventana aparece una línea como:

   ```
   https://ejemplo-palabras-azar.trycloudflare.com
   ```

   Ese es el link. Envíalo.
4. **No cierres** ninguna de las dos ventanas mientras la otra persona use la página.

### macOS / Linux

```bash
./publicar.sh
```

### A mano (cualquier sistema)

```bash
npm run publicar                                  # compila y arranca backend + página en :4000
cloudflared tunnel --url http://localhost:4000    # en otra terminal: entrega el link
```

Notas:
- El link cambia cada vez que se abre el túnel.
- Si al ingresar sale “Origen no autorizado”, reinicia el backend con la variable `PUBLIC_URL=https://<tu-link>`.
- En este modo los secretos de desarrollo se generan solos en `backend/data/db/`.

---

## Opción 3 · Docker Compose (arquitectura completa)

Un contenedor por microservicio, RabbitMQ, Nginx con HTTPS y redes aisladas.

```bash
cd backend && npm run generar-secretos      # copia la salida en un archivo .env en la raíz
cd .. && docker compose up --build
```

- Abre **https://localhost:8443** (acepta el certificado autofirmado).
- Otra persona en la **misma red Wi-Fi** puede entrar con `https://<IP-de-tu-PC>:8443` si agregas ese origen en `ALLOWED_ORIGINS` del `.env`.
- Para internet, combina con el túnel: `cloudflared tunnel --url https://localhost:8443 --no-tls-verify`.

### Probar la imagen de despliegue en tu equipo

```bash
docker build -f deploy/Dockerfile -t detritus-web .
docker run --rm -p 10000:10000 --env-file .env detritus-web
# abre http://localhost:10000
```

---

## Variables de entorno del despliegue

| Variable | Para qué | Valor en Render |
|---|---|---|
| `NODE_ENV` | Modo producción: exige secretos fuertes, cookie `Secure`, CORS estricto | `production` |
| `AUTH_SECRET`, `INTERNAL_KEY`, `DATA_KEY` | Firmar sesiones, firmar llamadas internas, cifrar datos | Generados por Render |
| `PORT` | Puerto público del gateway | `10000` (lo pone la imagen) |
| `STATIC_DIR` | Carpeta de la página compilada que sirve el gateway | `/app/web` (lo pone la imagen) |
| `RABBITMQ_DISABLED` | Eventos por HTTP en lugar de RabbitMQ | `1` (lo pone la imagen) |
| `SEED_DEMO` / `VITE_SHOW_DEMO_ACCOUNTS` | Crear y mostrar cuentas de prueba | `1` / `true` |
| `TRUST_PROXY` | Tomar la IP real del visitante para el límite de peticiones | `1` |
| `PUBLIC_URL` | Origen permitido extra (Render usa `RENDER_EXTERNAL_URL` automáticamente) | — |
| `AUTO_RECOVER_MINUTES` | Minutos tras los cuales se enciende solo un servicio apagado desde la consola | `10` |
| `DISABLED_SERVICES` | Arrancar con servicios apagados, p. ej. `pqrs,content` | — |

## Guion para la persona que recibe el link

1. Abre el link. Navega por *Afiliados*, *Trámites* y *Nosotros*.
2. Pulsa **Ingresar** → *Cuentas de prueba* → elige **Afiliado** (`123456789` / `demo123`). Agenda una cita en *Trámites → Agendar cita*.
3. Cierra sesión e ingresa como **Médico** (`900000001` / `doctor123`): verás la cita en tu agenda; atiéndela.
4. Ingresa como **Administrador** (`900000002` / `admin123`) → Consola → **Microservicios**: apaga `pqrs` y comprueba que el resto del sitio sigue funcionando (ver [09-tolerancia-a-fallos.md](09-tolerancia-a-fallos.md)). Vuelve a encenderlo.
