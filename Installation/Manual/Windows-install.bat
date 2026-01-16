@echo off
chcp 65001 >nul

echo ============================================
echo   Room Booking System - Windows Installation
echo ============================================
echo.
echo Dieser Installer richtet die App automatisch ein.
echo.

REM ===============================
REM Supabase Variablen
REM ===============================
set NEXT_PUBLIC_SUPABASE_URL=https://wwhbkfatevjhrgegxzhx.supabase.co
set NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5Wx9ZQItlO148NP8CLB8tQ_ZDo13oWD

REM ===============================
REM Node.js prüfen
REM ===============================
echo [1/5] Pruefe Node.js Installation...
node --version >nul 2>&1 || goto NODE_MISSING
echo OK: Node.js installiert.

REM ===============================
REM npm install
REM ===============================
echo [2/5] Installiere Abhaengigkeiten...
npm install || goto NPM_INSTALL_FAILED
echo OK: Abhaengigkeiten installiert.

REM ===============================
REM Build
REM ===============================
echo [3/5] Baue Anwendung...
npm run build || goto BUILD_FAILED
echo OK: Build erfolgreich.

REM ===============================
REM Start
REM ===============================
echo [4/5] Starte Anwendung...
echo App laeuft unter: http://localhost:3000
echo Beenden mit STRG+C
echo.

npm start
goto END

REM ===============================
REM Fehlerbehandlung
REM ===============================
:NODE_MISSING
echo.
echo FEHLER: Node.js ist nicht installiert.
echo Bitte installiere Node.js (LTS):
echo https://nodejs.org/
pause
goto END

:NPM_INSTALL_FAILED
echo.
echo FEHLER: npm install fehlgeschlagen.
pause
goto END

:BUILD_FAILED
echo.
echo FEHLER: Build fehlgeschlagen.
pause
goto END

:END
echo.
pause
