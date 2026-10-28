# Detritus Salud E.P.S. — React + Vite

Sitio web institucional de Detritus Salud E.P.S., construido con React, Vite y React Router.

## Cómo correr el proyecto

**Forma rápida (Windows):** doble clic en `iniciar.cmd`. Instala lo necesario la primera vez, abre el backend en otra ventana y abre la página en el navegador.

**Forma manual:**

Se necesitan **dos terminales** abiertas al mismo tiempo:

```bash
# Terminal 1 — backend (microservicios + API Gateway en el puerto 4000)
cd backend
npm install        # solo la primera vez
npm start          # inicia los 7 servicios y el gateway
```

```bash
# Terminal 2 — frontend (desde la carpeta raíz)
npm install        # solo la primera vez
npm run dev        # Abre en http://localhost:5173
```

En Windows también puedes hacer doble clic en `backend/start-all.cmd`.

Para comprobar que el backend está bien, abre http://localhost:4000/api/health: todos los servicios deben decir `"ok"`. Si en el inicio de sesión aparece "No hay conexión con el backend", es porque la terminal 1 no está corriendo.

## Microservicios y bases de datos

El backend está en `backend/`: un API Gateway (puerto 4000) y 7 microservicios. Cada microservicio tiene **su propia base de datos** (patrón *Database per Service*): ningún servicio lee las tablas de otro; cuando necesita un dato ajeno lo pide por HTTP al dueño o lo recibe por un evento de RabbitMQ.

| Microservicio | Puerto | Base de datos | Esquema SQL | Tablas principales |
|---|---|---|---|---|
| auth | 4001 | `data/db/auth.sqlite` | `data/schemas/auth.sql` | `login_attempts`, `password_resets` |
| users | 4002 | `data/db/users.sqlite` | `data/schemas/users.sql` | `dim_affiliates`, `user_roles`, `dim_plans`, `dim_beneficiaries` |
| content | 4003 | `data/db/content.sqlite` | `data/schemas/content.sql` | `content_items` |
| notifications | 4004 | `data/db/notifications.sqlite` | `data/schemas/notifications.sql` | `fact_notifications` |
| healthcare | 4005 | `data/db/healthcare.sqlite` | `data/schemas/healthcare.sql` | `dim_doctors`, `doctor_schedules`, `doctor_absences`, `fact_appointments`, `fact_authorizations`, `clinical_backgrounds`, `clinical_encounters` |
| pqrs | 4006 | `data/db/pqrs.sqlite` | `data/schemas/pqrs.sql` | `fact_pqrs`, `pqrs_status_history` |
| meds-labs | 4007 | `data/db/meds-labs.sqlite` | `data/schemas/meds-labs.sql` | `fact_prescriptions`, `fact_medication_dispensations`, `fact_lab_results`, `fact_lab_result_items` |

- Los archivos `.sqlite` se crean solos al iniciar cada servicio. Para verlos en VS Code abre cualquiera de `backend/data/db/*.sqlite` con la extensión SQLite. Para empezar de cero, borra la carpeta `backend/data/db`.
- `http://localhost:4000/api/health` muestra el estado de cada servicio y el nombre de su base.
- Con Docker (`docker compose up --build`) cada servicio monta su propio volumen (`auth-db`, `users-db`, `pqrs-db`…).
- La identidad común es `affiliate_id`: vive en users-service y los demás servicios la guardan como referencia lógica (sin llave foránea entre bases distintas).

Detalle de cada servicio, cuentas de prueba y flujos en [backend/README.md](backend/README.md).

## Notificaciones por correo, SMS y WhatsApp

Cada proceso (citas, reasignaciones por incapacidad, autorizaciones, fórmulas, resultados de laboratorio, PQRS, recuperación de contraseña) publica un evento. Notifications Service lo recibe por RabbitMQ o, si RabbitMQ no está corriendo, por HTTP, y envía el mensaje por **correo, SMS y WhatsApp** a los datos de contacto del usuario.

- **Modo demostración (por defecto):** no sale nada a internet; los mensajes quedan en *Portal → Notificaciones* marcados como “Simulado”.
- **Envío real:** copia `backend/.env.example` como `backend/.env`, pon `NOTIFICATIONS_MODE=live` y las credenciales (Gmail con contraseña de aplicación para el correo; Twilio para SMS y WhatsApp). `npm start` lee ese archivo automáticamente.

## Pruebas automáticas (GitHub Actions)

```bash
npm test                 # pruebas del frontend (validaciones)
npm --prefix backend test   # 39 pruebas: unitarias + integración de los 7 microservicios
npm run build            # build de producción
```

Las pruebas de integración levantan todo el backend con bases temporales, sin RabbitMQ y con la fecha fija del lunes 2 de noviembre de 2026, así que dan el mismo resultado en cualquier computador. El flujo `.github/workflows/ci.yml` las ejecuta en cada *push* y *pull request* (backend, frontend + build y construcción de las imágenes Docker).

El comando debe ejecutarse desde la carpeta raíz del proyecto, donde están `package.json` e `index.html`.

## Logo
El logo principal se encuentra en `public/logo.png`.

## Imágenes
Las imágenes de las páginas se encuentran en `public/img/`.
Para agregar una nueva imagen, guárdala allí y úsala desde React con una ruta como `/img/nombre-de-imagen.jpg`.

## Estructura
```
src/
├── components/    # Navbar, Footer, ChatFab, PageHero, InfoCard, StepList, Alert
├── pages/         # Home, Afiliados, Trámites, Atención y Nosotros
├── styles/        # global.css: variables y estilos base
├── App.jsx        # Rutas de la aplicación con React Router
└── main.jsx       # Punto de entrada
```

## Build para producción
```bash
npm run build      # Genera carpeta dist/ lista para desplegar
```

La carpeta `dist/` se genera automáticamente y no debe subirse al repositorio.
