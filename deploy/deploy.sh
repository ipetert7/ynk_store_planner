#!/bin/bash
set -e

echo "========================================"
echo "🚀 Deploy YNK Modelo iniciado"
echo "Fecha: $(date)"
echo "========================================"

# Ir al directorio del proyecto
cd /opt/ynk-modelo

repair_permissions() {
  local repo_path="$1"
  echo "🔐 Intentando reparar permisos en $repo_path..."

  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo chown -R "$(id -u):$(id -g)" "$repo_path"
    sudo chmod -R u+rwX "$repo_path"
    echo "✅ Permisos reparados"
  else
    echo "❌ No se pudieron reparar permisos automáticamente"
    echo "   Ejecuta en el servidor y vuelve a correr el deploy:"
    echo "   sudo chown -R $(id -un):$(id -gn) $repo_path"
    echo "   sudo chmod -R u+rwX $repo_path"
    exit 1
  fi
}

update_code() {
  echo "📥 Actualizando código desde GitHub..."

  if git fetch origin main && git reset --hard origin/main; then
    return 0
  fi

  echo "⚠️ Falló la actualización de código. Probable problema de permisos."
  repair_permissions "/opt/ynk-modelo"
  git fetch origin main
  git reset --hard origin/main
}

update_code

echo "🐳 Construyendo imagen Docker..."
./scripts/docker-build.sh

echo "♻️ Reiniciando servicios Docker..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

echo "========================================"
echo "✅ Deploy finalizado correctamente"
echo "========================================"
