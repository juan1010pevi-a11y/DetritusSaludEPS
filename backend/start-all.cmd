@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias del backend...
  call npm install
)
node src/start-all.js
pause
