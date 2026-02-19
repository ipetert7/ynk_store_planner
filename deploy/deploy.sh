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

ensure_runtime_permissions() {
  local repo_path="$1"
  local runtime_dirs=("$repo_path/data" "$repo_path/output" "$repo_path/logs")

  echo "🧰 Verificando permisos de runtime para Docker..."
  mkdir -p "${runtime_dirs[@]}"

  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    # El contenedor corre como UID/GID 1000 (usuario ynk en la imagen)
    sudo chown -R 1000:1000 "${runtime_dirs[@]}"
    sudo chmod -R ug+rwX "${runtime_dirs[@]}"
    echo "✅ Permisos de runtime ajustados para UID/GID 1000"
  else
    # Fallback sin sudo: permitir acceso de lectura/escritura/ejecución.
    chmod -R a+rwX "${runtime_dirs[@]}"
    echo "⚠️ Ajuste sin sudo aplicado (a+rwX) en data/output/logs"
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
ensure_runtime_permissions "/opt/ynk-modelo"

echo "🐳 Construyendo imagen Docker..."
./scripts/docker-build.sh

echo "♻️ Reiniciando servicios Docker..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

echo "========================================"
echo "✅ Deploy finalizado correctamente"
echo "========================================"
