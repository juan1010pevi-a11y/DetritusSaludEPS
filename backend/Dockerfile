FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY data ./data
EXPOSE 4000 4001 4002 4003 4004 4005 4006
CMD ["node", "src/gateway.js"]
