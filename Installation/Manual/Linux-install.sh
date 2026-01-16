#!/bin/bash

echo "Room Booking System - Installation (Linux)"
echo

# In Projekt-Root wechseln
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../.." || exit 1

# Node.js prüfen
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js ist nicht installiert."
  echo "Bitte installieren Sie Node.js (LTS): https://nodejs.org"
  exit 1
fi

npm install
npm run dev
