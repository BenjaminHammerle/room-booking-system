cd../..
@echo off
chcp 65001 >nul
echo ============================================
echo   Room Booking System - Deinstallation
echo ============================================
echo.

echo 📊 Aktueller Status vor der Deinstallation...
echo.

REM 1. Prüfe ob Container existiert und stoppe ihn
echo [1/5] Prüfe laufende Container...
docker ps --filter "name=room-booking" --format "table {{.Names}}\t{{.Status}}" 2>nul | findstr "room-booking" >nul
if %errorlevel% equ 0 (
    echo 🔴 Container läuft noch - stoppe ihn...
    docker stop room-booking
    timeout /t 2 /nobreak >nul
    echo ✅ Container gestoppt.
) else (
    echo ℹ️ Kein laufender Container gefunden.
)

REM 2. Entferne gestoppten Container
echo [2/5] Entferne Container...
docker rm room-booking 2>nul
if %errorlevel% equ 0 (
    echo ✅ Container entfernt.
) else (
    echo ℹ️ Container existierte nicht oder konnte nicht entfernt werden.
)

REM 3. Lösche Docker Image
echo [3/5] Lösche Docker Image...
docker rmi room-booking-system 2>nul
if %errorlevel% equ 0 (
    echo ✅ Image entfernt.
) else (
    echo ℹ️ Image existierte nicht oder konnte nicht entfernt werden.
)

REM 4. Optional: Lösche verwaiste Images (dangling)
echo [4/5] Bereinige verwaiste Images...
docker image prune -f 2>nul
echo ✅ Verwaiste Images entfernt.

REM 5. Optional: Lösche verwaiste Container
echo [5/5] Bereinige verwaiste Container...
docker container prune -f 2>nul
echo ✅ Verwaiste Container entfernt.

echo.
echo ============================================
echo ✅ DEINSTALLATION ABGESCHLOSSEN!
echo ============================================
echo.
echo Folgende Komponenten wurden entfernt:
echo   • Container: room-booking
echo   • Image: room-booking-system
echo   • Verwaiste Docker-Objekte
echo.
echo Um die App neu zu installieren, führe aus:
echo   Windows-install.bat
echo.
pause