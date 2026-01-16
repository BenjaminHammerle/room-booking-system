#!/bin/bash

# ============================================
#   Room Booking System - Installation (Linux)
# ============================================

cd../..
echo ""
echo "============================================"
echo "   Room Booking System - Installation"
echo "============================================"
echo ""
echo "Dieser Installer richtet die App automatisch ein."
echo ""

# Supabase Variablen
SUPABASE_URL="https://wwhbkfatevjhrgegxzhx.supabase.co"
SUPABASE_KEY="sb_publishable_5Wx9ZQItlO148NP8CLB8tQ_ZDo13oWD"

# Prüfe ob Docker installiert ist
echo "[1/5] Prüfe Docker Installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker ist nicht installiert!"
    echo ""
    echo "Bitte installiere Docker:"
    echo "Ubuntu/Debian: sudo apt-get install docker.io"
    echo "Fedora: sudo dnf install docker"
    echo "Arch: sudo pacman -S docker"
    echo ""
    echo "Oder folge der Anleitung: https://docs.docker.com/engine/install/"
    echo ""
    read -p "Drücke Enter zum Beenden..."
    exit 1
fi

echo "✅ Docker ist installiert."

# Prüfe ob Docker läuft
echo "[2/5] Prüfe ob Docker läuft..."
if ! docker info &> /dev/null; then
    echo "⚠️  Docker läuft nicht. Starte Docker mit:"
    echo "sudo systemctl start docker"
    echo "sudo systemctl enable docker"
    echo ""
    echo "Füge deinen Benutzer zur Docker-Gruppe hinzu:"
    echo "sudo usermod -aG docker \$USER"
    echo "Dann abmelden und wieder anmelden."
    echo ""
    read -p "Drücke Enter zum Beenden..."
    exit 1
fi

echo "✅ Docker läuft."

# Image bauen MIT Build-Arguments
echo "[3/5] Baue Docker Image..."
echo "INFO: Verwende Supabase URL: $SUPABASE_URL"
if ! docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_KEY" \
  -t room-booking-system .; then
    echo "❌ Build fehlgeschlagen! Bitte überprüfe die Fehlermeldung."
    read -p "Drücke Enter zum Beenden..."
    exit 1
fi

echo "✅ Image erfolgreich gebaut."

# Container starten
echo "[4/5] Starte Room Booking System..."
docker stop room-booking 2>/dev/null
docker rm room-booking 2>/dev/null

if ! docker run -d \
  -p 3000:3000 \
  --name room-booking \
  room-booking-system; then
    echo "❌ Container konnte nicht gestartet werden!"
    read -p "Drücke Enter zum Beenden..."
    exit 1
fi

echo "✅ Container gestartet."

# Warte kurz und prüfe
echo "[5/5] Prüfe Installation..."
sleep 5

if docker ps | grep -q "room-booking"; then
    echo ""
    echo "============================================"
    echo "✅ INSTALLATION ERFOLGREICH!"
    echo "============================================"
    echo ""
    echo "Die Room Booking System App läuft jetzt auf:"
    echo "🌐 http://localhost:3000"
    echo ""
    echo "📝 Nützliche Befehle:"
    echo "   ./install.sh       - Startet die App erneut"
    echo "   ./uninstall.sh     - Deinstalliert die App"
    echo "   ./status.sh        - Zeigt App-Status"
    echo ""

    # Frage ob Browser geöffnet werden soll
    read -p "Möchtest du die App jetzt im Browser öffnen? (j/N): " OPEN_BROWSER
    if [[ "$OPEN_BROWSER" =~ ^[Jj]$ ]]; then
        if command -v xdg-open &> /dev/null; then
            xdg-open "http://localhost:3000"
        elif command -v gnome-open &> /dev/null; then
            gnome-open "http://localhost:3000"
        elif command -v open &> /dev/null; then
            open "http://localhost:3000"
        else
            echo "Browser konnte nicht automatisch geöffnet werden."
        fi
    fi
else
    echo "❌ Installation fehlgeschlagen!"
    echo "Überprüfe Docker und starte neu."

    # Zeige Docker Logs für Debugging
    echo ""
    echo "Letzte Logs vom Container:"
    docker logs room-booking
fi

echo ""
read -p "Drücke Enter zum Beenden..."