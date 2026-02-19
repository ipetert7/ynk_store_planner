"""Compatibilidad hacia atrás para ejecutar el CLI modularizado."""
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from ynk_modelo.cli.main import main


if __name__ == "__main__":
    # Ejecutar en modo no interactivo por defecto (sin selector)
    if "--sin-selector" not in sys.argv and "--sucursal" not in sys.argv:
        sys.argv.append("--sin-selector")
    main()
