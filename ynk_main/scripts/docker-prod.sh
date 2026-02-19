#!/bin/bash
# Script para ejecutar en producción (Rocky Linux 8.9)
# Usa docker-compose con configuración de producción

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
echo -e "${BLUE}YNK Modelo - Deploy Producción (Rocky Linux)${NC}"
echo "========================================================================"
echo ""

# Verificar que Docker y Docker Compose están instalados
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗${NC} Docker no está instalado"
    echo "   Instala Docker Engine: sudo dnf install docker docker-compose"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗${NC} Docker Compose no está instalado"
    exit 1
fi

# Verificar que estamos en modo producción
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠${NC}  Creando archivo .env desde .env.example..."
    cp .env.example .env
    sed -i 's/ENVIRONMENT=local/ENVIRONMENT=prod/' .env
fi

# Cargar variables
export $(grep -v '^#' .env | xargs)

# Forzar modo producción
export ENVIRONMENT=prod

# Construir imagen si no existe
if ! docker images | grep -q "ynk-modelo"; then
    echo "Construyendo imagen..."
    ./scripts/docker-build.sh
fi

# Crear directorios
mkdir -p data output logs

# Usar docker-compose o docker compose (según versión)
COMPOSE_CMD="docker-compose"
if ! command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
fi

echo ""
echo "Iniciando servicios en modo producción..."
echo ""

# Levantar servicios
$COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml up -d

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓${NC} Servicios iniciados en modo producción"
    echo ""
    echo "Servidor disponible en: http://localhost:${PORT:-8000}"
    echo ""
    echo "Comandos útiles:"
    echo "  Ver logs:        $COMPOSE_CMD logs -f"
    echo "  Detener:         $COMPOSE_CMD down"
    echo "  Reiniciar:       $COMPOSE_CMD restart"
    echo "  Estado:          $COMPOSE_CMD ps"
    echo ""
    echo "Para configurar como servicio systemd, ver DOCKER.md"
    echo ""
else
    echo ""
    echo -e "${RED}✗${NC} Error al iniciar servicios"
    exit 1
fi
