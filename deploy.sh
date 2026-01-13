#!/bin/bash
set -e

echo "========================================"
echo "🚀 Deploy YNK Modelo iniciado"
echo "Fecha: $(date)"
echo "========================================"

# Ir al directorio del proyecto
cd /opt/ynk-modelo

echo "📥 Actualizando código desde GitHub..."
git pull origin main

echo "🐳 Construyendo imagen Docker..."
./scripts/docker-build.sh

echo "♻️ Reiniciando servicios Docker..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

echo "========================================"
echo "✅ Deploy finalizado correctamente"
echo "========================================"
