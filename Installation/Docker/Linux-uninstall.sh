#!/bin/bash

# ============================================
#   Room Booking System - Deinstallation (Linux)
# ============================================

cd ../..
echo ""
echo "============================================"
echo "   Room Booking System - Deinstallation"
echo "============================================"
echo ""

echo "📊 Aktueller Status vor der Deinstallation..."
echo ""

# 1. Prüfe ob Container existiert und stoppe ihn
echo "[1/5] Prüfe laufende Container..."
if docker ps --filter "name=room-booking" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -q "room-booking"; then
    echo "🔴 Container läuft noch - stoppe ihn..."
    docker stop room-booking
    sleep 2
    echo "✅ Container gestoppt."
else
    echo "ℹ️  Kein laufender Container gefunden."
fi

# 2. Entferne gestoppten Container
echo "[2/5] Entferne Container..."
if docker rm room-booking 2>/dev/null; then
    echo "✅ Container entfernt."
else
    echo "ℹ️  Container existierte nicht oder konnte nicht entfernt werden."
fi

# 3. Lösche Docker Image
echo "[3/5] Lösche Docker Image..."
if docker rmi room-booking-system 2>/dev/null; then
    echo "✅ Image entfernt."
else
    echo "ℹ️  Image existierte nicht oder konnte nicht entfernt werden."
fi

# 4. Optional: Lösche verwaiste Images (dangling)
echo "[4/5] Bereinige verwaiste Images..."
docker image prune -f 2>/dev/null
echo "✅ Verwaiste Images entfernt."

# 5. Optional: Lösche verwaiste Container
echo "[5/5] Bereinige verwaiste Container..."
docker container prune -f 2>/dev/null
echo "✅ Verwaiste Container entfernt."

echo ""
echo "============================================"
echo "✅ DEINSTALLATION ABGESCHLOSSEN!"
echo "============================================"
echo ""
echo "Folgende Komponenten wurden entfernt:"
echo "  • Container: room-booking"
echo "  • Image: room-booking-system"
echo "  • Verwaiste Docker-Objekte"
echo ""
echo "Um die App neu zu installieren, führe aus:"
echo "  ./Linux-install.sh"
echo ""
read -p "Drücke Enter zum Beenden..."