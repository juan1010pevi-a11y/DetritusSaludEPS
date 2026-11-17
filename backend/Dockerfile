FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY data/schemas ./data/schemas
# La carpeta de la base pertenece al usuario sin privilegios "node" (el volumen hereda el dueño).
RUN mkdir -p /app/data/db && chown -R node:node /app/data/db
USER node
EXPOSE 4000 4001 4002 4003 4004 4005 4006 4007
CMD ["node", "src/gateway.js"]
