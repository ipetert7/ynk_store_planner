#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.integrated.yml"
ENV_FILE="$ROOT_DIR/.env"

echo "[INFO] Root: $ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker is not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[ERROR] docker compose plugin is not available."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] Missing $ENV_FILE"
  echo "[HINT] Copy .env.integrated.example to .env and set real secrets."
  exit 1
fi

mkdir -p \
  "$ROOT_DIR/ynk_main/data" \
  "$ROOT_DIR/ynk_main/output" \
  "$ROOT_DIR/ynk_main/logs" \
  "$ROOT_DIR/ynk_modulo gestor arriendos/prisma" \
  "$ROOT_DIR/ynk_modulo gestor arriendos/backups"

echo "[INFO] Starting integrated stack..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

echo
echo "[INFO] Containers status:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo
echo "[INFO] Follow logs with:"
echo "docker compose --env-file \"$ENV_FILE\" -f \"$COMPOSE_FILE\" logs -f nginx ynk-main ynk-arriendos"
