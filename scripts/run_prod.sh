#!/bin/bash
# Script para ejecutar servidor en modo PRODUCCIÓN

echo "=========================================="
echo "YNK Modelo - Servidor PRODUCCIÓN"
echo "=========================================="

# Activar entorno virtual si existe
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Establecer ambiente en PROD
export ENVIRONMENT=prod

# Ejecutar servidor web
echo "Iniciando servidor web..."
echo "Accede a: http://localhost:8000"
echo ""

python3 -m ynk_modelo.cli.server
