#!/bin/bash
# Script para ejecutar servidor en modo LOCAL

echo "=========================================="
echo "YNK Modelo - Servidor LOCAL"
echo "=========================================="

# Activar entorno virtual si existe
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Establecer ambiente en LOCAL
export ENVIRONMENT=local

# Ejecutar servidor web
echo "Iniciando servidor web..."
echo "Accede a: http://localhost:8000"
echo ""
echo "MODO LOCAL: Sin auto-verificación"
echo ""

python3 -m ynk_modelo.cli.server
