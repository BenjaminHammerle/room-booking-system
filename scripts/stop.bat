@echo off
REM Stoppt Node.js-Prozess auf Port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Room Booking System gestoppt
pause