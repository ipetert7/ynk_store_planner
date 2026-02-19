"""Configuración y utilidades de base de datos SQLite."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from ynk_modelo.config import PROJECT_ROOT
from ynk_modelo.utils.logger import get_logger

logger = get_logger()

# Ruta de la base de datos
DB_PATH = PROJECT_ROOT / "data" / "ynk_users.db"


def get_db() -> sqlite3.Connection:
    """Obtiene una conexión a la base de datos."""
    # Crear directorio si no existe
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Permite acceso por nombre de columna
    return conn


def init_db() -> None:
    """Inicializa la base de datos creando todas las tablas."""
    logger.info("Inicializando base de datos SQLite...")
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Tabla de usuarios
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Tabla de roles
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Tabla de permisos
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                resource TEXT NOT NULL,
                action TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Tabla de relación usuario-rol
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                UNIQUE(user_id, role_id)
            )
        """)
        
        # Tabla de relación rol-permiso
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS role_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                UNIQUE(role_id, permission_id)
            )
        """)
        
        # Índices para mejorar rendimiento
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id)")
        
        conn.commit()
        logger.info(f"✓ Base de datos inicializada: {DB_PATH}")
        
        # Crear roles y permisos por defecto
        _create_default_roles_and_permissions(cursor, conn)
        
    except Exception as e:
        conn.rollback()
        logger.error(f"✗ Error al inicializar base de datos: {e}", exc_info=True)
        raise
    finally:
        conn.close()


def _create_default_roles_and_permissions(cursor: sqlite3.Cursor, conn: sqlite3.Connection) -> None:
    """Crea roles y permisos por defecto basados en módulos/rutas."""
    logger.info("Creando/verificando roles y permisos por defecto...")

    # Crear solo el rol admin si no existe
    cursor.execute(
        "INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)",
        ("admin", "Administrador con acceso completo a todos los módulos")
    )
    cursor.execute("SELECT id FROM roles WHERE name = ?", ("admin",))
    admin_role_row = cursor.fetchone()
    if not admin_role_row:
        logger.warning("Rol 'admin' no encontrado ni creado")
        return
    admin_role_id = admin_role_row[0]

    # Crear permisos basados en módulos/rutas
    permissions = [
        ("access_admin_users", "Acceso a gestión de usuarios", "/admin/users", "access"),
        ("access_eerr_report", "Acceso a reporte EERR", "/EERR_por_tienda.html", "access"),
        ("access_simulator", "Acceso a simulador", "/Simulador_EERR.html", "access"),
        ("access_rent_manager", "Acceso a gestor de arriendos", "/arriendos", "access"),
    ]

    permission_ids = {}
    for perm_name, description, resource, action in permissions:
        cursor.execute(
            "INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES (?, ?, ?, ?)",
            (perm_name, description, resource, action)
        )
        cursor.execute("SELECT id FROM permissions WHERE name = ?", (perm_name,))
        permission_ids[perm_name] = cursor.fetchone()[0]

    # Asignar todos los permisos al rol admin
    for perm_id in permission_ids.values():
        cursor.execute(
            "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
            (admin_role_id, perm_id)
        )

    conn.commit()
    logger.info("✓ Roles y permisos por defecto verificados")
    logger.info(f"  - Rol 'admin' con {len(permission_ids)} permisos")


def migrate_users_from_config(config_file: Path | None = None) -> None:
    """Migra usuarios desde archivo de configuración a la base de datos."""
    if config_file is None:
        config_file = PROJECT_ROOT / "config" / "users.txt"
    
    if not config_file.exists():
        logger.warning(f"Archivo de configuración no encontrado: {config_file}")
        return
    
    logger.info(f"Migrando usuarios desde {config_file}...")
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        from werkzeug.security import generate_password_hash
        
        with open(config_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                
                # Formato: usuario:contraseña:nombre_completo:rol
                parts = line.split(":")
                if len(parts) < 4:
                    continue
                
                username, password, full_name, role_name = parts[:4]
                
                # Verificar si el usuario ya existe
                cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
                if cursor.fetchone():
                    logger.debug(f"Usuario '{username}' ya existe, omitiendo")
                    continue
                
                # Obtener ID del rol
                cursor.execute("SELECT id FROM roles WHERE name = ?", (role_name,))
                role_row = cursor.fetchone()
                if not role_row:
                    logger.warning(f"Rol '{role_name}' no encontrado para usuario '{username}'")
                    continue
                
                role_id = role_row[0]
                
                # Crear usuario
                password_hash = generate_password_hash(password)
                cursor.execute(
                    """INSERT INTO users (username, password_hash, full_name, is_active)
                       VALUES (?, ?, ?, 1)""",
                    (username, password_hash, full_name)
                )
                user_id = cursor.lastrowid
                
                # Asignar rol
                cursor.execute(
                    "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
                    (user_id, role_id)
                )
                
                logger.info(f"✓ Usuario '{username}' migrado con rol '{role_name}'")
        
        conn.commit()
        logger.info("✓ Migración de usuarios completada")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"✗ Error al migrar usuarios: {e}", exc_info=True)
        raise
    finally:
        conn.close()
