# Detritus Salud E.P.S. — React + Vite

## Cómo correr el proyecto

```bash
cd detritus-react
npm install        # Solo la primera vez (descarga React, Vite, etc.)
npm run dev        # Abre en http://localhost:5173
```

## Logo
Guarda tu logo como: `public/logo.png`

## Imágenes de subpáginas
Guarda las imágenes en: `public/img/`
Ejemplo: `public/img/copagos.jpg`

## Estructura
```
src/
├── components/    ← Navbar, Footer, ChatFab, PageHero, InfoCard, StepList, Alert
├── pages/         ← Home, Afiliados (12), Tramites (10), Atencion (1), Nosotros (6)
├── styles/        ← global.css (variables y reset)
├── App.jsx        ← Todas las rutas (React Router)
└── main.jsx       ← Punto de entrada
```

## Build para producción
```bash
npm run build      # Genera carpeta dist/ lista para desplegar
```
