#!/bin/bash
set -euo pipefail

echo "========================================"
echo "🚀 Deploy integrado iniciado"
echo "Fecha: $(date)"
echo "========================================"

cd /opt/ynk-modelo

echo "📥 Actualizando código desde GitHub..."
git fetch origin main
git pull --ff-only origin main

if [ ! -f "docker-compose.integrated.yml" ]; then
  echo "❌ Missing docker-compose.integrated.yml in /opt/ynk-modelo"
  exit 1
fi

echo "🐳 Construyendo servicios..."
docker compose -f docker-compose.integrated.yml build ynk-main ynk-arriendos nginx

echo "♻️ Levantando stack integrado..."
docker compose -f docker-compose.integrated.yml up -d --remove-orphans

echo "📋 Estado de contenedores..."
docker compose -f docker-compose.integrated.yml ps

echo "🧾 Últimos logs de ynk-arriendos..."
docker compose -f docker-compose.integrated.yml logs --tail=80 ynk-arriendos

echo "========================================"
echo "✅ Deploy integrado finalizado"
echo "========================================"
