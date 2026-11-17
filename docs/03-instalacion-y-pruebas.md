# 3. Procedimientos de instalación y prueba

## 3.1 Requisitos no funcionales

| ID | Categoría | Restricción |
|---|---|---|
| RNF-01 | Disponibilidad | Si un microservicio se cae, los demás siguen atendiendo; el gateway responde `503` solo para la sección afectada. Un servicio caído por error se reinicia solo en 3 s (supervisor o `restart: unless-stopped` en Docker). |
| RNF-02 | Rendimiento | Llamadas internas con timeout de 5 s y cortacircuitos (tras 3 fallas no se insiste durante 15 s). Gateway con timeout de 15 s hacia los servicios y protección contra conexiones lentas. |
| RNF-03 | Seguridad | HTTPS, sesión de 15 min + refresh token rotado, cifrado AES-256-GCM de datos clínicos, límite de peticiones por IP. Detalle en [07-seguridad.md](07-seguridad.md). |
| RNF-04 | Privacidad | Cumplimiento de la Ley 1581 de 2012: autorización de tratamiento de datos con fecha y versión; los eventos del bus no llevan datos clínicos. |
| RNF-05 | Usabilidad | Diseño adaptable (celular, tableta, computador); mensajes de error en lenguaje claro. |
| RNF-06 | Portabilidad | Corre en Windows, macOS y Linux con Node.js 22 o superior; o en cualquier equipo con Docker. |
| RNF-07 | Mantenibilidad | Un archivo por microservicio, un esquema `.sql` por base, pruebas automáticas en cada cambio. |
| RNF-08 | Capacidad (demo) | Límites por IP configurables: 300 peticiones/min generales, 20/min de ingreso, 30/min de consultas públicas. |

## 3.2 Obtención e instalación

### Requisitos previos

- **Node.js 22 o superior** (https://nodejs.org, versión LTS). Comprueba con `node -v`.
- **Git** (opcional, para clonar).
- **Docker Desktop** (opcional, solo para la opción B).

### Obtener el código

```bash
git clone https://github.com/juan1010pevi-a11y/DetritusSaludEPS.git
cd DetritusSaludEPS
```

o descomprime el `.zip` del proyecto y abre la carpeta.

### Opción A · Desarrollo (lo más sencillo)

**Windows:** doble clic en `iniciar.cmd`. Instala todo la primera vez, abre el backend en otra ventana y la página en el navegador.

**Cualquier sistema (dos terminales):**

```bash
# Terminal 1 · backend (7 microservicios + gateway en el puerto 4000)
cd backend
npm install
npm start

# Terminal 2 · frontend (http://localhost:5173)
npm install
npm run dev
```

No hay que configurar secretos: en desarrollo se generan solos en `backend/data/db/.dev-secrets.json` (carpeta ignorada por Git).

### Opción B · Docker (como en producción)

```bash
cd backend && npm run generar-secretos     # copia la salida en un archivo .env en la raíz
cd .. && docker compose up --build
```

Abre **https://localhost:8443** y acepta el certificado autofirmado.

### Opción C · Publicar con un link

Ver [08-despliegue.md](08-despliegue.md).

### Cuentas de prueba

| Perfil | Documento | Contraseña |
|---|---|---|
| Afiliado | `123456789` | `demo123` |
| Médico (medicina general) | `900000001` | `doctor123` |
| Médico (laboratorio) | `900000007` | `medico123` |
| Afiliada y médica | `1010101010` | `demo123` |
| Administrador | `900000002` | `admin123` |

Lista completa en `backend/README.md`. En producción se ocultan si `VITE_SHOW_DEMO_ACCOUNTS=false` y no se crean si `SEED_DEMO=0`.

### Comprobar que quedó bien

- http://localhost:4000/api/health → todos los servicios en `"ok"` y `"status": "ok"`.
- Si la página dice “No hay conexión con el backend”, la terminal 1 no está corriendo.

## 3.3 Especificaciones de prueba y ejecución

### Plataforma de prueba

| Elemento | Versión / valor |
|---|---|
| Sistema operativo | Windows 10/11, Ubuntu 22.04+ (GitHub Actions `ubuntu-latest`), macOS |
| Node.js | 22 (CI) y 24 (imágenes Docker) |
| Navegadores | Chrome, Edge, Firefox (últimas versiones) |
| Base de datos | SQLite (sql.js) temporal por cada ejecución de pruebas |
| Fecha simulada | Lunes 2 de noviembre de 2026, 6:00 a. m. (`FAKE_NOW`), para resultados repetibles |

### Pruebas automáticas

```bash
npm test                     # frontend: validaciones
npm --prefix backend test    # backend: unitarias, integración, seguridad y tolerancia a fallos
npm run build                # build de producción
```

| Archivo | Qué prueba |
|---|---|
| `backend/test/unit.test.js` | Reglas puras: cruces de horario, validadores, vencimiento de PQRS, plantillas |
| `backend/test/integration.test.js` | Los 7 microservicios juntos: bases separadas, citas, incapacidades, historia clínica, fórmulas, laboratorios, PQRS, notificaciones |
| `backend/test/security.test.js` | Contraseñas, JWT, refresh tokens, TOTP, cabeceras, CORS, límite de peticiones, rutas internas, cifrado, IDOR |
| `backend/test/resilience.test.js` | **Tolerancia a fallos**: apaga microservicios y verifica que los demás responden; el supervisor apaga/enciende desde la consola y reinicia un servicio caído |
| `src/lib/validators.test.js` | Validaciones del navegador |

Las pruebas levantan todo el backend en puertos propios con bases temporales y sin RabbitMQ, por lo que dan el mismo resultado en cualquier computador. GitHub Actions las ejecuta en cada *push* y *pull request* (`.github/workflows/ci.yml`).

### Prueba manual de tolerancia a fallos

1. Inicia el backend con `npm start` y la página con `npm run dev`.
2. Ingresa como administrador (`900000002` / `admin123`) → Consola → **Microservicios**.
3. Apaga `pqrs`. Aparece el aviso amarillo “Servicio parcialmente disponible” en todo el sitio.
4. Abre *Trámites → Agendar cita* y *Afiliados → Resultados de laboratorio*: funcionan.
5. Abre *Trámites → Radicar PQRSD*: muestra “El servicio de PQRSD no está disponible en este momento. El resto del portal sigue funcionando.”
6. Vuelve a la consola y enciende `pqrs`.

Detalle y alternativas (terminal, Docker) en [09-tolerancia-a-fallos.md](09-tolerancia-a-fallos.md).
