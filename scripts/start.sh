#!/bin/bash

echo "Starte Room Booking System..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

npm run start
