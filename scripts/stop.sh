#!/bin/bash
# Script para detener el servidor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.server.pid"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠${NC}  Servidor no está corriendo (no se encontró .server.pid)"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ! ps -p $PID > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC}  Proceso no encontrado (PID: $PID)"
    rm -f "$PID_FILE"
    exit 0
fi

echo "Deteniendo servidor YNK Modelo (PID: $PID)..."
kill $PID

# Esperar a que termine
for i in {1..10}; do
    if ! ps -p $PID > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Si aún está corriendo, forzar
if ps -p $PID > /dev/null 2>&1; then
    echo "Forzando detención..."
    kill -9 $PID
fi

rm -f "$PID_FILE"
echo -e "${GREEN}✓${NC} Servidor detenido"
