#!/bin/bash
# Script para ejecutar servidor en background (daemon)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PID_FILE="$PROJECT_DIR/.server.pid"
LOG_FILE="$PROJECT_DIR/logs/server.log"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

start_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠${NC}  Servidor ya está corriendo (PID: $PID)"
            echo "   Detén el servidor primero con: ./scripts/stop.sh"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi
    
    echo "========================================================================"
    echo "Iniciando servidor YNK Modelo en background..."
    echo "========================================================================"
    
    # Crear directorio de logs
    mkdir -p logs
    
    # Activar venv si existe
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    fi
    
    # Cargar .env
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    # Iniciar servidor en background
    nohup python3 -m ynk_modelo.cli.server > "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    
    sleep 2
    
    if ps -p $PID > /dev/null; then
        echo -e "${GREEN}✓${NC} Servidor iniciado exitosamente"
        echo "   PID: $PID"
        echo "   Ambiente: ${ENVIRONMENT:-local}"
        echo "   URL: http://localhost:${PORT:-8000}"
        echo "   Logs: $LOG_FILE"
        echo ""
        echo "Comandos útiles:"
        echo "   Ver logs:      tail -f $LOG_FILE"
        echo "   Detener:       ./scripts/stop.sh"
        echo "   Estado:        ./scripts/status.sh"
        echo "========================================================================"
    else
        echo -e "${RED}✗${NC} Error al iniciar servidor"
        echo "   Ver logs: cat $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

start_server
