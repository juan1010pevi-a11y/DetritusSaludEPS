FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY data/schemas ./data/schemas
EXPOSE 4000 4001 4002 4003 4004 4005 4006 4007
CMD ["node", "src/gateway.js"]
