#!/bin/bash
# Script para reiniciar el servidor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Reiniciando servidor YNK Modelo..."
echo ""

"$SCRIPT_DIR/stop.sh"
sleep 2
"$SCRIPT_DIR/daemon_start.sh"
