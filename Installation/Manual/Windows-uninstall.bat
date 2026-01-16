@echo off

echo =========================================
echo Room Booking System - Deinstallation
echo Manuell - ohne Docker
echo =========================================
echo.

REM --- In Projekt-Root wechseln ---
cd /d "%~dp0\..\.."

echo Beende laufende Node.js Prozesse...
taskkill /f /im node.exe >nul 2>nul

echo.
echo Anwendung wurde beendet.
echo Es wurden keine Dateien geloescht.
echo.
pause
exit /b 0
