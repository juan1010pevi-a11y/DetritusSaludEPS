@echo off
cd /d "%~dp0"
start "Detritus Auth Service" cmd /k "node src/auth-service.js"
start "Detritus Users Service" cmd /k "node src/users-service.js"
start "Detritus Content Service" cmd /k "node src/content-service.js"
start "Detritus Notifications Service" cmd /k "node src/notifications-service.js"
start "Detritus Healthcare Service" cmd /k "node src/healthcare-service.js"
start "Detritus PQRS Service" cmd /k "node src/pqrs-service.js"
timeout /t 1 /nobreak >nul
start "Detritus API Gateway" cmd /k "node src/gateway.js"
echo Servicios iniciados. Mantenga abiertas las ventanas del backend.
pause
