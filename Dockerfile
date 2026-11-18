# Frontend de producción en 3 etapas:
#  1) compila React con Vite;  2) genera un certificado TLS autofirmado para localhost;
#  3) lo sirve con Nginx sin privilegios (usuario nginx, puertos 8080/8443).
# En producción real, monta tu certificado en /etc/nginx/certs (tls.crt y tls.key).

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ARG VITE_HCAPTCHA_SITEKEY=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS \
    VITE_HCAPTCHA_SITEKEY=$VITE_HCAPTCHA_SITEKEY
RUN npm run build

FROM alpine:3.20 AS certs
RUN apk add --no-cache openssl \
 && mkdir /certs \
 && openssl req -x509 -nodes -newkey rsa:2048 -days 365 -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
      -keyout /certs/tls.key -out /certs/tls.crt \
 && chmod 0644 /certs/tls.crt /certs/tls.key

FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=certs /certs /etc/nginx/certs
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080 8443
