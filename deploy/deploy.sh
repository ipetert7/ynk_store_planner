#!/bin/bash
# Script para transferir archivos desde Mac a Rocky Linux

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuración
REMOTE_USER="your_user"
REMOTE_HOST="your_server.com"
REMOTE_PATH="/path/to/YNK_Store Planner"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "========================================================================"
echo -e "${BLUE}YNK Modelo - Deploy a Rocky Linux${NC}"
echo "========================================================================"

# Verificar configuración
echo ""
echo -e "${YELLOW}Configuración actual:${NC}"
echo "  Local:  $PROJECT_DIR"
echo "  Remoto: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
echo ""
read -p "¿Es correcta esta configuración? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${RED}✗${NC} Edita este script y configura REMOTE_USER, REMOTE_HOST y REMOTE_PATH"
    exit 1
fi

# 1. Crear directorio remoto
echo ""
echo -e "${BLUE}1. Creando directorio en servidor...${NC}"
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_PATH/{data,output,logs,static,templates,src,deploy,scripts}"

# 2. Transferir código fuente
echo ""
echo -e "${BLUE}2. Transfiriendo código fuente...${NC}"
rsync -avz --progress \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git' \
    --exclude='logs/*' \
    --exclude='output/*.html' \
    --exclude='.data_cache.json' \
    --exclude='.server.pid' \
    --exclude='.env' \
    $PROJECT_DIR/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

# 3. Transferir archivos de data (si existen)
echo ""
echo -e "${BLUE}3. Transfiriendo archivos de datos...${NC}"
if [ "$(ls -A $PROJECT_DIR/data/*.xlsx 2>/dev/null)" ]; then
    rsync -avz --progress \
        $PROJECT_DIR/data/*.xlsx \
        $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/data/
    echo -e "${GREEN}✓${NC} Archivos Excel transferidos"
else
    echo -e "${YELLOW}⚠${NC}  No se encontraron archivos .xlsx en data/"
fi

# 4. Ejecutar instalación en servidor
echo ""
echo -e "${BLUE}4. Ejecutando instalación en servidor...${NC}"
read -p "¿Ejecutar instalación automática? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    ssh -t $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && sudo ./deploy/install.sh"
else
    echo -e "${YELLOW}⚠${NC}  Ejecuta manualmente en el servidor:"
    echo "   ssh $REMOTE_USER@$REMOTE_HOST"
    echo "   cd $REMOTE_PATH"
    echo "   sudo ./deploy/install.sh"
fi

# 5. Resumen
echo ""
echo "========================================================================"
echo -e "${GREEN}✓ Deploy completado${NC}"
echo "========================================================================"
echo ""
echo "Para conectarte al servidor:"
echo "  ssh $REMOTE_USER@$REMOTE_HOST"
echo ""
echo "Comandos útiles en el servidor:"
echo "  sudo systemctl start ynk-modelo     # Iniciar servicio"
echo "  sudo systemctl status ynk-modelo    # Ver estado"
echo "  sudo systemctl restart ynk-modelo   # Reiniciar"
echo "  sudo journalctl -u ynk-modelo -f    # Ver logs"
echo "  tail -f logs/server.log             # Logs de aplicación"
echo ""
echo "========================================================================"
