#!/bin/bash
# Script para construir la imagen Docker
# Compatible con Mac y Rocky Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "========================================================================"
echo -e "${BLUE}YNK Modelo - Construcción de Imagen Docker${NC}"
echo "========================================================================"
echo ""

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}✗${NC} Docker no está instalado"
    echo "   Instala Docker Desktop para Mac o Docker Engine para Linux"
    exit 1
fi

# Nombre de la imagen
IMAGE_NAME="ynk-modelo"
IMAGE_TAG="${1:-latest}"

echo "Construyendo imagen: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

# Construir imagen
docker build \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    -t "${IMAGE_NAME}:latest" \
    -f Dockerfile \
    .

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓${NC} Imagen construida exitosamente"
    echo ""
    echo "Imagen: ${IMAGE_NAME}:${IMAGE_TAG}"
    echo ""
    echo "Para ejecutar:"
    echo "  ./scripts/docker-run.sh"
    echo "  o"
    echo "  docker-compose up -d"
    echo ""
else
    echo ""
    echo -e "${YELLOW}✗${NC} Error al construir la imagen"
    exit 1
fi
