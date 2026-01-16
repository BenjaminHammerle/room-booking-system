#!/bin/bash

echo "Stoppe Room Booking System..."

pkill -u "$USER" node 2>/dev/null

echo "Anwendung gestoppt."
