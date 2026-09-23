# Microservicios de Detritus Salud

Este MVP separa el backend en servicios independientes y expone un API Gateway en el puerto `4000`.

## Ejecutar

Desde `backend/`, abre una terminal por proceso:

```powershell
npm run auth
npm run users
npm run content
npm run notifications
npm run healthcare
npm run pqrs
npm run gateway
```

Credenciales académicas de prueba:

- Documento: `123456789`
- Contraseña: `demo123`

Rutas de prueba:

- `GET http://localhost:4000/api/content/news`
- `GET http://localhost:4000/api/users/affiliates/demo`
- `POST http://localhost:4000/api/auth/login`
- `POST http://localhost:4000/api/notifications/notifications`
- `POST http://localhost:4000/api/healthcare/appointments`
- `POST http://localhost:4000/api/pqrs/requests`

RabbitMQ y los servicios se inician con `docker compose up --build` desde la raíz. La base SQLite se guarda en el volumen Docker `detritus-data` y se inicializa automáticamente desde `data/schema.sql`.

## Persistencia y modelo de datos

La persistencia usa `sql.js` (SQLite compatible con Node y Docker). El archivo generado es `data/detritus.sqlite`; no se versiona porque se crea al iniciar los servicios.

El modelo sigue un esquema de estrella:

- Dimensiones: `dim_affiliates`, `dim_plans`, `dim_services` y `dim_dates`.
- Hechos por microservicio: `fact_appointments`, `fact_authorizations`, `fact_pqrs` y `fact_notifications`.
- Contenido: `content_items`.

La llave de integración es `affiliate_id`. Cada cita, autorización, PQRS y notificación la usa como llave foránea hacia `dim_affiliates`; el afiliado se relaciona con su plan mediante `plan_id`. Así, la interfaz puede consultar cada servicio a través del Gateway y complementar la información con el mismo identificador.

El patrón tomado de `microservicios-main` fue la separación de configuración, modelo, controlador y rutas, adaptada aquí al servidor HTTP existente para no duplicar gateways ni contratos de la interfaz.
