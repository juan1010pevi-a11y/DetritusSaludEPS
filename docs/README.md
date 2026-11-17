# Documentación · Detritus Salud E.P.S.

Documentación técnica del proyecto integrador **Detritus Salud E.P.S.**: portal web de una EPS construido con React (frontend) y 7 microservicios Node.js detrás de un API Gateway (backend).

La estructura sigue la guía de documentación del curso (definición general, requerimientos, instalación y prueba, arquitectura, modelo de datos y especificación de la API) y agrega las secciones de seguridad, despliegue y tolerancia a fallos.

| # | Documento | Qué responde |
|---|---|---|
| 1 | [Definición general del proyecto](01-definicion-general.md) | ¿Qué es? ¿Para qué? ¿Quién lo usa? |
| 2 | [Requerimientos del proyecto de software](02-requerimientos.md) | Requisitos generales y funcionales, autoría y *legacy*, alcances |
| 3 | [Procedimientos de instalación y prueba](03-instalacion-y-pruebas.md) | Requisitos no funcionales, obtención e instalación, pruebas |
| 4 | [Arquitectura del sistema](04-arquitectura.md) | Descripción jerárquica, diagrama de módulos, descripción de cada módulo |
| 5 | [Diseño del modelo de datos](05-modelo-de-datos.md) | Una base de datos por microservicio, tablas y columnas |
| 6 | [Documentación técnica · Especificación API](06-especificacion-api.md) | Manual del programador: rutas, permisos, convenciones |
| 7 | [Seguridad para un sitio en producción](07-seguridad.md) | SSDLC (CLASP, SSDF, S-SDLC, Microsoft SDL, BSIMM), pipeline de seguridad, política de bloqueo, *hardening* |
| 8 | [Despliegue](08-despliegue.md) | Cómo publicar la página y compartir el link |
| 9 | [Tolerancia a fallos](09-tolerancia-a-fallos.md) | Cómo apagar un microservicio y comprobar que los demás siguen funcionando |
| 10 | [Diagrama de arquitectura de microservicios](10-diagrama-arquitectura.md) | Diagrama por capas del sistema tal como está implementado |

Documentos relacionados en la raíz del proyecto:

- [`README.md`](../README.md): cómo correr el proyecto en desarrollo.
- [`SEGURIDAD.md`](../SEGURIDAD.md): inventario detallado de controles de seguridad por capa.
- [`CAMBIOS.md`](../CAMBIOS.md): observaciones de las revisiones y cómo se resolvieron.
- [`backend/README.md`](../backend/README.md): cuentas de prueba y reglas de negocio (citas, incapacidades, PQRS).

**Ficha del proyecto**

| | |
|---|---|
| Institución | Universidad Católica de Colombia · Ingeniería de Sistemas y Computación |
| Tipo | Proyecto integrador (Producción de software) |
| Repositorio | https://github.com/juan1010pevi-a11y/DetritusSaludEPS |
| Versión documentada | 1.1 (noviembre de 2026) |
