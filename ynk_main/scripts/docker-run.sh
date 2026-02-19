#!/bin/bash
# Script para ejecutar el contenedor Docker
# Compatible con Mac y Rocky Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "========================================================================"
echo -e "${BLUE}YNK Modelo - Ejecutar Contenedor Docker${NC}"
echo "========================================================================"
echo ""

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗${NC} Docker no está instalado"
    exit 1
fi

# Cargar variables de entorno
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    echo -e "${GREEN}✓${NC} Variables de .env cargadas"
else
    echo -e "${YELLOW}⚠${NC}  Archivo .env no encontrado, usando valores por defecto"
fi

# Verificar que la imagen existe
IMAGE_NAME="ynk-modelo:latest"
if ! docker images | grep -q "ynk-modelo"; then
    echo -e "${YELLOW}⚠${NC}  Imagen no encontrada. Construyendo..."
    ./scripts/docker-build.sh
fi

# Detener contenedor existente si está corriendo
if docker ps -a | grep -q "ynk-modelo"; then
    echo "Deteniendo contenedor existente..."
    docker stop ynk-modelo 2>/dev/null || true
    docker rm ynk-modelo 2>/dev/null || true
fi

# Crear directorios necesarios
mkdir -p data output logs

# Puerto
PORT=${PORT:-8000}

echo ""
echo "Iniciando contenedor..."
echo "  Puerto: ${PORT}"
echo "  Ambiente: ${ENVIRONMENT:-local}"
echo ""

# Ejecutar contenedor
docker run -d \
    --name ynk-modelo \
    -p "${PORT}:8000" \
    -e ENVIRONMENT="${ENVIRONMENT:-local}" \
    -e PORT=8000 \
    -e SECRET_KEY="${SECRET_KEY:-ynk-dev-secret-key-change-in-production}" \
    -e AUTO_REGENERATE="${AUTO_REGENERATE:-true}" \
    -e CHECK_INTERVAL="${CHECK_INTERVAL:-300}" \
    -e LOG_DIR=/app/logs \
    -v "$(pwd)/data:/app/data" \
    -v "$(pwd)/output:/app/output" \
    -v "$(pwd)/logs:/app/logs" \
    -v "$(pwd)/config:/app/config:ro" \
    -v "$(pwd)/templates:/app/templates" \
    -v "$(pwd)/static:/app/static" \
    --restart unless-stopped \
    "${IMAGE_NAME}"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓${NC} Contenedor iniciado exitosamente"
    echo ""
    echo "Servidor disponible en: http://localhost:${PORT}"
    echo ""
    echo "Comandos útiles:"
    echo "  Ver logs:        docker logs -f ynk-modelo"
    echo "  Detener:         docker stop ynk-modelo"
    echo "  Reiniciar:       docker restart ynk-modelo"
    echo "  Estado:          docker ps | grep ynk-modelo"
    echo ""
else
    echo ""
    echo -e "${RED}✗${NC} Error al iniciar el contenedor"
    exit 1
fi
