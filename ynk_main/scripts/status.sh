#!/bin/bash
# Script para ver el estado del servidor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.server.pid"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================================================"
echo "Estado del Servidor YNK Modelo"
echo "========================================================================"

if [ ! -f "$PID_FILE" ]; then
    echo -e "${RED}✗${NC} Servidor NO está corriendo"
    echo ""
    echo "Para iniciar:"
    echo "  ./scripts/daemon_start.sh    # En background"
    echo "  ./scripts/start.sh           # En foreground"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ps -p $PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Servidor está CORRIENDO"
    echo ""
    echo "PID: $PID"
    
    # Cargar .env para mostrar config
    if [ -f "$PROJECT_DIR/.env" ]; then
        export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
        echo "Ambiente: ${ENVIRONMENT:-local}"
        echo "Puerto: ${PORT:-8000}"
        echo "URL: http://localhost:${PORT:-8000}"
    fi
    
    echo ""
    echo "Comandos útiles:"
    echo "  Ver logs:    tail -f logs/server.log"
    echo "  Detener:     ./scripts/stop.sh"
    echo "  Reiniciar:   ./scripts/restart.sh"
else
    echo -e "${RED}✗${NC} Proceso no encontrado (PID: $PID era el último registrado)"
    rm -f "$PID_FILE"
fi

echo "========================================================================"
