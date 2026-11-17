# Imagen "todo en uno" para publicar Detritus Salud EPS con un solo link (Render, Railway, Fly.io…).
#   - Compila el frontend (React + Vite).
#   - Corre los 7 microservicios + API Gateway con el supervisor (start-all.js): si un servicio
#     se cae se levanta solo, y el administrador puede apagar/encender servicios desde la consola.
#   - El gateway sirve la página y la API en la misma dirección (STATIC_DIR).
#   - Sin RabbitMQ: los eventos viajan por HTTP a notifications (respaldo ya incluido en broker.js).
# Construir desde la raíz del proyecto:  docker build -f deploy/Dockerfile -t detritus-web .

FROM node:24-alpine AS web
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
# Las cuentas de prueba no se muestran por defecto en el sitio público.
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ARG VITE_HCAPTCHA_SITEKEY=
ENV VITE_API_URL=/api \
    VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS \
    VITE_HCAPTCHA_SITEKEY=$VITE_HCAPTCHA_SITEKEY
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production \
    RABBITMQ_DISABLED=1 \
    SEED_DEMO=0 \
    STATIC_DIR=/app/web \
    DATA_DIR=/app/backend/data/db \
    PORT=10000
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY backend/src ./src
COPY backend/data/schemas ./data/schemas
COPY --from=web /app/dist /app/web
# Usuario sin privilegios; solo puede escribir en la carpeta de las bases.
RUN mkdir -p /app/backend/data/db && chown -R node:node /app/backend/data/db
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:${PORT}/api/ping || exit 1
CMD ["node", "src/start-all.js"]
