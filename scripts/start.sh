#!/bin/bash
# Script de inicio automático - Detecta ambiente desde .env

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "========================================================================"
echo -e "${BLUE}YNK Modelo - Servidor Auto-inicio${NC}"
echo "========================================================================"

# Activar entorno virtual si existe
if [ -d ".venv" ]; then
    echo -e "${GREEN}✓${NC} Activando entorno virtual..."
    source .venv/bin/activate
fi

# Cargar variables de .env
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    echo -e "${GREEN}✓${NC} Variables de .env cargadas"
else
    echo -e "${YELLOW}⚠${NC}  Archivo .env no encontrado, usando valores por defecto"
    export ENVIRONMENT=local
fi

# Mostrar ambiente detectado
echo ""
echo "Configuración detectada:"
echo "  • Ambiente: ${ENVIRONMENT:-local}"
echo "  • Puerto: ${PORT:-8000}"
echo ""

# Determinar modo
if [ "${ENVIRONMENT}" = "prod" ]; then
    echo "========================================================================"
    echo -e "${GREEN}MODO PRODUCCIÓN ACTIVADO${NC}"
    echo "========================================================================"
    echo "✓ Auto-verificación de cambios: ACTIVADA"
    echo "✓ Logs: logs/ynk_modelo_$(date +%Y%m%d).log"
    echo ""
    echo "Páginas disponibles:"
    echo "  • http://localhost:${PORT:-8000}/EERR_por_tienda.html"
    echo "  • http://localhost:${PORT:-8000}/Simulador_EERR.html"
    echo ""
    echo "API endpoints:"
    echo "  • http://localhost:${PORT:-8000}/api/check"
    echo "  • http://localhost:${PORT:-8000}/api/status"
    echo "========================================================================"
else
    echo "========================================================================"
    echo -e "${YELLOW}MODO LOCAL ACTIVADO${NC}"
    echo "========================================================================"
    echo "✓ Sin auto-verificación"
    echo "✓ Para PROD, edita .env y cambia: ENVIRONMENT=prod"
    echo ""
    echo "Páginas disponibles:"
    echo "  • http://localhost:${PORT:-8000}/EERR_por_tienda.html"
    echo "  • http://localhost:${PORT:-8000}/Simulador_EERR.html"
    echo "========================================================================"
fi

echo ""
echo -e "${BLUE}Iniciando servidor...${NC}"
echo "Presiona Ctrl+C para detener"
echo ""

# Ejecutar servidor
python3 -m ynk_modelo.cli.server --port ${PORT:-8000}
