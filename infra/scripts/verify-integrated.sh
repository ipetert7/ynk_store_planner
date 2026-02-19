#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-192.168.18.155}"
COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/docker-compose.integrated.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker is not installed."
  exit 1
fi

echo "[INFO] docker compose ps"
docker compose -f "$COMPOSE_FILE" ps

echo
echo "[INFO] HTTP probe: http://$HOST/"
curl -sS -o /dev/null -D - "http://$HOST/" | sed -n '1,5p'

echo
echo "[INFO] HTTP probe: http://$HOST/arriendos"
curl -sS -o /dev/null -D - "http://$HOST/arriendos" | sed -n '1,8p'

echo
echo "[INFO] If status is not 200/301/302, review logs:"
echo "docker compose -f \"$COMPOSE_FILE\" logs --tail=200 nginx ynk-main ynk-arriendos"
