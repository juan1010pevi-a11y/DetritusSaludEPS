@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Detritus Salud - Frontend

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Instalando dependencias del frontend, espera un momento...
  call npm install
)
if not exist "backend\node_modules\sql.js" (
  echo Instalando dependencias del backend, espera un momento...
  pushd backend
  call npm install
  popd
)

echo Cerrando un backend anterior si quedo abierto...
taskkill /FI "WINDOWTITLE eq Detritus Salud - Backend*" /T /F >nul 2>nul
timeout /t 2 /nobreak >nul
echo Iniciando backend en otra ventana...
start "Detritus Salud - Backend" cmd /k "cd /d ""%~dp0backend"" && node src/start-all.js"
timeout /t 8 /nobreak >nul

echo Iniciando la pagina web. Se abrira el navegador automaticamente.
echo No cierres esta ventana ni la del backend mientras uses la pagina.
call npm run dev -- --open
pause
