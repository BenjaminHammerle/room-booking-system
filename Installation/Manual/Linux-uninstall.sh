#!/bin/bash

echo "========================================="
echo "Room Booking System - Deinstallation"
echo "Manuell - ohne Docker (Linux)"
echo "========================================="
echo

echo "Beende laufende Node.js Prozesse..."

# Beendet nur Node-Prozesse des aktuellen Users
pkill -u "$USER" node 2>/dev/null

echo
echo "Anwendung wurde beendet."
echo "Es wurden keine Dateien geloescht."
echo
