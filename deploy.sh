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
  echo "🔐 Reparando permisos en $repo_path (necesario para git)..."
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo chown -R "$(id -u):$(id -g)" "$repo_path"
    sudo chmod -R u+rwX "$repo_path"
    echo "✅ Permisos reparados"
  else
    echo "❌ No se pudo reparar: ejecuta en el servidor:"
    echo "   sudo chown -R \$(whoami):\$(id -gn) $repo_path"
    echo "   sudo chmod -R u+rwX $repo_path"
    exit 1
  fi
}

# Comprobar si podemos escribir en .git (evita "Permiso denegado" en FETCH_HEAD)
if ! test -w .git 2>/dev/null; then
  echo "⚠️ Sin permisos de escritura en .git. Reparando..."
  repair_permissions "/opt/ynk-modelo"
fi

echo "📥 Actualizando código desde GitHub..."
git fetch origin main
git reset --hard origin/main

echo "🐳 Construyendo imagen Docker..."
./scripts/docker-build.sh

echo "♻️ Reiniciando servicios Docker..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

echo "========================================"
echo "✅ Deploy finalizado correctamente"
echo "========================================"
