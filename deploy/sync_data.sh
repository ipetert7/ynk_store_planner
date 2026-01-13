#!/bin/bash
# Script para sincronizar solo archivos de data (actualización rápida)

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración (debe coincidir con deploy.sh)
REMOTE_USER="your_user"
REMOTE_HOST="your_server.com"
REMOTE_PATH="/path/to/YNK_Store Planner"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "========================================================================"
echo -e "${BLUE}Sincronizando archivos de datos...${NC}"
echo "========================================================================"

# Transferir archivos Excel
rsync -avz --progress \
    $PROJECT_DIR/data/*.xlsx \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/data/

echo ""
echo -e "${GREEN}✓${NC} Archivos sincronizados"
echo ""
echo "Los reportes se regenerarán automáticamente al visitar las páginas"
echo ""
