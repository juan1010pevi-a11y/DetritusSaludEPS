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

La persistencia del backend usa SQLite mediante `sql.js`. El esquema se encuentra en [backend/data/schema.sql](backend/data/schema.sql), se inicializa al arrancar y queda persistido en el volumen Docker `detritus-data`. La llave foránea común entre los microservicios es `affiliate_id`, que conecta las tablas de citas, autorizaciones, PQRS y notificaciones con la dimensión de afiliados.

La identidad se mantiene una sola vez: `document` identifica a la persona y `affiliate_id` identifica su cuenta dentro de la EPS. Los perfiles de acceso se relacionan en `user_roles` con la llave compuesta `(user_id, role)`. Por eso una persona puede ser `affiliate` y `doctor` a la vez sin duplicar la cédula ni agregar sufijos; las tablas clínicas siguen usando `affiliate_id` como llave foránea.

Para ver las tablas en VS Code, abre `backend/data/detritus.sqlite` desde la extensión SQLite instalada y selecciona la opción para abrir la base de datos. El archivo local se crea o actualiza al iniciar un servicio del backend. Cuando uses Docker, la base vive en el volumen `detritus-data`, por lo que debes inspeccionar el archivo local o exportar/copiar la base del contenedor antes de abrirla en VS Code.

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
