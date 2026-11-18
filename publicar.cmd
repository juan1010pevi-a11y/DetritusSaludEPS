@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Detritus Salud - Publicar con link
rem ============================================================================
rem  Publica la pagina desde ESTE computador y entrega un link https publico
rem  (https://xxxx.trycloudflare.com) para que otra persona la abra y la use.
rem  El link funciona mientras este computador y estas ventanas sigan abiertos.
rem  Para un link permanente usa Render (ver docs\08-despliegue.md).
rem ============================================================================

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo Falta "cloudflared", el programa que crea el link publico. Instalandolo con winget...
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  echo.
  echo Si se instalo bien, CIERRA esta ventana y vuelve a abrir publicar.cmd.
  echo Si winget no existe, descargalo de https://github.com/cloudflare/cloudflared/releases - archivo cloudflared-windows-amd64.msi.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Instalando dependencias del frontend...
  call npm install
)
if not exist "backend\node_modules\sql.js" (
  echo Instalando dependencias del backend...
  pushd backend
  call npm install
  popd
)

echo Compilando la pagina (npm run build)...
call npm run build
if errorlevel 1 (
  echo La compilacion fallo. Revisa el error de arriba.
  pause
  exit /b 1
)

echo Cerrando un backend anterior si quedo abierto...
taskkill /FI "WINDOWTITLE eq Detritus Salud - Backend*" /T /F >nul 2>nul
timeout /t 2 /nobreak >nul
echo Iniciando backend + pagina en http://localhost:4000 (otra ventana)...
start "Detritus Salud - Backend" cmd /k "cd /d ""%~dp0backend"" && node src/start-all.js --con-frontend"
timeout /t 8 /nobreak >nul

echo.
echo ============================================================================
echo  Creando el link publico. Busca abajo una linea como:
echo      https://algo-algo-algo.trycloudflare.com
echo  Copiala y enviala. NO cierres esta ventana ni la del backend.
echo ============================================================================
echo.
cloudflared tunnel --url http://localhost:4000
pause
