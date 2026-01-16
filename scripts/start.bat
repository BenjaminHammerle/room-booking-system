@echo off
chcp 65001 >nul

REM Setze Arbeitsverzeichnis auf Projekt-Root
cd /d %~dp0\..

set NEXT_PUBLIC_SUPABASE_URL=https://wwhbkfatevjhrgegxzhx.supabase.co
set NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5Wx9ZQItlO148NP8CLB8tQ_ZDo13oWD

echo Starte Room Booking System...
echo URL: http://localhost:3000
npm start
pause
