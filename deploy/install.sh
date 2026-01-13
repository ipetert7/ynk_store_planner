#!/bin/bash
# Script de instalación para Rocky Linux

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========================================================================"
echo -e "${BLUE}YNK Modelo - Instalación en Rocky Linux${NC}"
echo "========================================================================"

# Verificar que se ejecuta como root para instalación de servicio
if [ "$EUID" -eq 0 ]; then 
    IS_ROOT=true
    echo -e "${YELLOW}⚠${NC}  Ejecutando como root"
else
    IS_ROOT=false
    echo -e "${GREEN}✓${NC} Ejecutando como usuario normal"
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "Directorio del proyecto: $PROJECT_DIR"
echo ""

# 1. Instalar dependencias del sistema
echo -e "${BLUE}1. Instalando dependencias del sistema...${NC}"
if [ "$IS_ROOT" = true ]; then
    dnf install -y python3 python3-pip python3-venv
else
    echo -e "${YELLOW}⚠${NC}  Instala manualmente: sudo dnf install -y python3 python3-pip python3-venv"
fi

# 2. Crear entorno virtual
echo ""
echo -e "${BLUE}2. Creando entorno virtual...${NC}"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo -e "${GREEN}✓${NC} Entorno virtual creado"
else
    echo -e "${YELLOW}⚠${NC}  Entorno virtual ya existe"
fi

# 3. Activar y actualizar pip
echo ""
echo -e "${BLUE}3. Actualizando pip...${NC}"
source .venv/bin/activate
pip install --upgrade pip

# 4. Instalar paquete
echo ""
echo -e "${BLUE}4. Instalando paquete YNK Modelo...${NC}"
pip install -e .

# 5. Crear directorios necesarios
echo ""
echo -e "${BLUE}5. Creando directorios...${NC}"
mkdir -p logs output data static/css static/images templates

# 6. Configurar .env
echo ""
echo -e "${BLUE}6. Configurando .env...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    sed -i 's/ENVIRONMENT=local/ENVIRONMENT=prod/' .env
    echo -e "${GREEN}✓${NC} Archivo .env creado en modo PROD"
else
    echo -e "${YELLOW}⚠${NC}  Archivo .env ya existe, verifica que ENVIRONMENT=prod"
fi

# 7. Configurar servicio systemd
echo ""
echo -e "${BLUE}7. Configurando servicio systemd...${NC}"

if [ "$IS_ROOT" = true ]; then
    # Obtener usuario actual (antes de sudo)
    ACTUAL_USER="${SUDO_USER:-$USER}"
    ACTUAL_GROUP=$(id -gn $ACTUAL_USER)
    
    # Crear archivo de servicio
    sed -e "s|YOUR_USER|$ACTUAL_USER|g" \
        -e "s|YOUR_GROUP|$ACTUAL_GROUP|g" \
        -e "s|/path/to/YNK_Store Planner|$PROJECT_DIR|g" \
        deploy/ynk-modelo.service > /etc/systemd/system/ynk-modelo.service
    
    # Recargar systemd
    systemctl daemon-reload
    
    # Habilitar servicio
    systemctl enable ynk-modelo.service
    
    echo -e "${GREEN}✓${NC} Servicio systemd configurado"
    echo "   Para iniciar: sudo systemctl start ynk-modelo"
    echo "   Ver estado:   sudo systemctl status ynk-modelo"
    echo "   Ver logs:     sudo journalctl -u ynk-modelo -f"
else
    echo -e "${YELLOW}⚠${NC}  Para instalar el servicio systemd, ejecuta como root:"
    echo "   sudo ./deploy/install.sh"
fi

# 8. Configurar firewall (si es necesario)
echo ""
echo -e "${BLUE}8. Configurando firewall...${NC}"
if [ "$IS_ROOT" = true ]; then
    if command -v firewall-cmd &> /dev/null; then
        PORT=$(grep PORT .env | cut -d '=' -f2 | tr -d ' ')
        PORT=${PORT:-8000}
        
        firewall-cmd --permanent --add-port=${PORT}/tcp
        firewall-cmd --reload
        
        echo -e "${GREEN}✓${NC} Puerto ${PORT} abierto en firewall"
    else
        echo -e "${YELLOW}⚠${NC}  firewalld no está instalado"
    fi
else
    echo -e "${YELLOW}⚠${NC}  Ejecuta como root para configurar firewall"
fi

# 9. Permisos
echo ""
echo -e "${BLUE}9. Configurando permisos...${NC}"
chmod +x scripts/*.sh
chmod 755 logs output
echo -e "${GREEN}✓${NC} Permisos configurados"

# Resumen
echo ""
echo "========================================================================"
echo -e "${GREEN}✓ Instalación completada${NC}"
echo "========================================================================"
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Verifica que los archivos Excel estén en data/"
echo ""
echo "2. Inicia el servicio:"
if [ "$IS_ROOT" = true ]; then
    echo "   sudo systemctl start ynk-modelo"
    echo "   sudo systemctl status ynk-modelo"
else
    echo "   ./scripts/daemon_start.sh"
fi
echo ""
echo "3. Verifica logs:"
echo "   tail -f logs/server.log"
echo ""
echo "4. Accede a:"
echo "   http://$(hostname -I | awk '{print $1}'):${PORT:-8000}/EERR_por_tienda.html"
echo ""
echo "========================================================================"
