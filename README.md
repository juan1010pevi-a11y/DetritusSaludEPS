# Detritus Salud E.P.S. — React + Vite

Sitio web institucional de Detritus Salud E.P.S., construido con React, Vite y React Router.

## Cómo correr el proyecto

```bash
npm install        # Instala React, Vite y las dependencias del proyecto
npm run dev        # Abre en http://localhost:5173
```

## Microservicios

El MVP backend se encuentra en `backend/`. Incluye API Gateway, Auth Service, Users Service, Content Service y Notifications Service. Consulta [backend/README.md](backend/README.md) para ejecutarlo.

RabbitMQ está definido en `docker-compose.yml` como broker de mensajes para notificaciones y eventos. Con Docker instalado, toda la arquitectura se puede iniciar con `docker compose up --build`.

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
