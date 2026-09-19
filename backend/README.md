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

RabbitMQ se inicia con `docker compose up -d` desde la raíz. Si no está disponible, los servicios continúan en modo local y dejan el evento registrado en consola.
