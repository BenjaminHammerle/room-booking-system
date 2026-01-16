cd../..
@echo off
chcp 65001 >nul
echo ============================================
echo   Room Booking System - Installation
echo ============================================
echo.
echo Dieser Installer richtet die App automatisch ein.
echo.

REM Setze Supabase Variablen
set SUPABASE_URL=https://wwhbkfatevjhrgegxzhx.supabase.co
set SUPABASE_KEY=sb_publishable_5Wx9ZQItlO148NP8CLB8tQ_ZDo13oWD

REM Prüfe ob Docker installiert ist
echo [1/5] Prüfe Docker Installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker ist nicht installiert!
    echo.
    echo Bitte installiere Docker Desktop von:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

echo ✅ Docker ist installiert.

REM Docker starten
echo [2/5] Prüfe ob Docker läuft...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️ Docker läuft nicht. Starte Docker Desktop manuell.
    echo Dann starte dieses Skript erneut.
    pause
    exit /b 1
)

echo ✅ Docker läuft.

REM Image bauen MIT Build-Arguments
echo [3/5] Baue Docker Image...
echo INFO: Verwende Supabase URL: %SUPABASE_URL%
docker build ^
  --build-arg NEXT_PUBLIC_SUPABASE_URL="%SUPABASE_URL%" ^
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="%SUPABASE_KEY%" ^
  -t room-booking-system .

if %errorlevel% neq 0 (
    echo ❌ Build fehlgeschlagen! Bitte überprüfe die Fehlermeldung.
    pause
    exit /b 1
)

echo ✅ Image erfolgreich gebaut.

REM Container starten
echo [4/5] Starte Room Booking System...
docker stop room-booking 2>nul
docker rm room-booking 2>nul

docker run -d ^
  -p 3000:3000 ^
  --name room-booking ^
  room-booking-system

if %errorlevel% neq 0 (
    echo ❌ Container konnte nicht gestartet werden!
    pause
    exit /b 1
)

echo ✅ Container gestartet.

REM Warte kurz und prüfe
echo [5/5] Prüfe Installation...
timeout /t 5 /nobreak >nul

docker ps | findstr "room-booking" >nul
if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo ✅ INSTALLATION ERFOLGREICH!
    echo ============================================
    echo.
    echo Die Room Booking System App läuft jetzt auf:
    echo 🌐 http://localhost:3000
    echo.
    echo 📝 Nützliche Befehle:
    echo    install.bat       - Startet die App erneut
    echo    uninstall.bat     - Deinstalliert die App
    echo    status.bat        - Zeigt App-Status
    echo.

) else (
    echo ❌ Installation fehlgeschlagen!
    echo Überprüfe Docker Desktop und starte neu.

    REM Zeige Docker Logs für Debugging
    echo.
    echo Letzte Logs vom Container:
    docker logs room-booking
)

echo.
pause