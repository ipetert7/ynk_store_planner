#!/usr/bin/env python3
"""Script para inicializar la base de datos SQLite."""
from __future__ import annotations

import sys
from pathlib import Path

# Agregar el directorio raíz al path
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root / "src"))

from ynk_modelo.database import init_db, migrate_users_from_config
from ynk_modelo.utils.logger import get_logger

logger = get_logger()


def main():
    """Inicializa la base de datos y migra usuarios."""
    print("=" * 70)
    print("YNK Modelo - Inicialización de Base de Datos")
    print("=" * 70)
    print()
    
    try:
        # Inicializar base de datos
        init_db()
        
        # Migrar usuarios desde config/users.txt si existe
        config_file = project_root / "config" / "users.txt"
        if config_file.exists():
            print()
            migrate_users_from_config(config_file)
        else:
            print()
            print("ℹ Archivo config/users.txt no encontrado, omitiendo migración")
        
        print()
        print("=" * 70)
        print("✓ Base de datos inicializada exitosamente")
        print("=" * 70)
        
    except Exception as e:
        print()
        print("=" * 70)
        print(f"✗ Error al inicializar base de datos: {e}")
        print("=" * 70)
        sys.exit(1)


if __name__ == "__main__":
    main()
