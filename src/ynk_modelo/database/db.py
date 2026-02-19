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

        _create_arriendos_schema(cursor)
        
        conn.commit()
        logger.info(f"✓ Base de datos inicializada: {DB_PATH}")
        
        # Crear roles y permisos por defecto
        _create_default_roles_and_permissions(cursor, conn)
        _create_arriendos_permissions(cursor, conn)
        
    except Exception as e:
        conn.rollback()
        logger.error(f"✗ Error al inicializar base de datos: {e}", exc_info=True)
        raise
    finally:
        conn.close()


def _create_default_roles_and_permissions(cursor: sqlite3.Cursor, conn: sqlite3.Connection) -> None:
    """Crea roles y permisos por defecto basados en módulos/rutas."""
    logger.info("Asegurando roles y permisos base...")

    admin_role_id = _ensure_admin_role(cursor)
    
    # Crear permisos basados en módulos/rutas
    permissions = [
        ("access_admin_users", "Acceso a gestión de usuarios", "/admin/users", "access"),
        ("access_eerr_report", "Acceso a reporte EERR", "/EERR_por_tienda.html", "access"),
        ("access_simulator", "Acceso a simulador", "/Simulador_EERR.html", "access"),
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
    logger.info("✓ Roles y permisos base asegurados")
    logger.info(f"  - Rol 'admin' creado con {len(permission_ids)} permisos")


def _create_arriendos_schema(cursor: sqlite3.Cursor) -> None:
    """Crea tablas e índices del módulo de arriendos."""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS feature_flags (
            key_name TEXT PRIMARY KEY,
            is_enabled INTEGER NOT NULL DEFAULT 0,
            updated_by INTEGER,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_code TEXT UNIQUE,
            name TEXT NOT NULL,
            banner TEXT,
            city TEXT,
            region TEXT,
            address TEXT,
            surface_m2 REAL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            notification_days INTEGER NOT NULL DEFAULT 90,
            created_by INTEGER,
            updated_by INTEGER,
            closed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS store_contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            contract_start TEXT NOT NULL,
            contract_end TEXT,
            base_rent_uf REAL NOT NULL DEFAULT 0,
            variable_rent_pct REAL NOT NULL DEFAULT 0,
            ggcc_clp REAL NOT NULL DEFAULT 0,
            promotion_fund_pct REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'UF',
            notes TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER,
            updated_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS temporary_modifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            contract_id INTEGER,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            reason TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER,
            updated_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
            FOREIGN KEY (contract_id) REFERENCES store_contracts(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS permanent_modifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            contract_id INTEGER,
            effective_date TEXT NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            reason TEXT,
            created_by INTEGER,
            updated_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
            FOREIGN KEY (contract_id) REFERENCES store_contracts(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS uf_values (
            uf_date TEXT PRIMARY KEY,
            value REAL NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            created_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS arriendos_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            details TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS backup_metadata (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            checksum_sha256 TEXT NOT NULL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            store_count INTEGER NOT NULL DEFAULT 0,
            created_by INTEGER,
            reason TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contracts_store_id ON store_contracts(store_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON store_contracts(contract_end)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_temp_mod_store_id ON temporary_modifications(store_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_temp_mod_dates ON temporary_modifications(start_date, end_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_perm_mod_store_id ON permanent_modifications(store_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_store_id ON arriendos_audit_log(store_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_created_at ON arriendos_audit_log(created_at)")

    cursor.execute(
        """
        INSERT OR IGNORE INTO feature_flags (key_name, is_enabled)
        VALUES ('arriendos_enabled', 1)
        """
    )


def _ensure_admin_role(cursor: sqlite3.Cursor) -> int:
    """Garantiza que exista el rol admin y retorna su ID."""
    cursor.execute(
        "INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)",
        ("admin", "Administrador con acceso completo a todos los módulos")
    )
    cursor.execute("SELECT id FROM roles WHERE name = ?", ("admin",))
    row = cursor.fetchone()
    if not row:
        raise RuntimeError("No fue posible crear/obtener rol admin")
    return int(row[0])


def _create_arriendos_permissions(cursor: sqlite3.Cursor, conn: sqlite3.Connection) -> None:
    """Crea permisos del módulo arriendos y los asigna al rol admin."""
    admin_role_id = _ensure_admin_role(cursor)

    permissions = [
        ("access_arriendos_dashboard", "Acceso al dashboard de arriendos", "/arriendos", "access"),
        ("manage_arriendos_stores", "Gestión de tiendas y contratos", "/arriendos/stores", "manage"),
        ("manage_arriendos_modifications", "Gestión de modificaciones de contratos", "/api/arriendos/stores/*/temporary-modifications", "manage"),
        ("manage_arriendos_import", "Importación masiva de arriendos", "/arriendos/settings/import", "manage"),
        ("manage_arriendos_backups", "Gestión de backups de arriendos", "/arriendos/backups", "manage"),
        ("view_arriendos_audit", "Visualización de auditoría de arriendos", "/api/arriendos/stores/*/audit", "view"),
        ("manage_arriendos_uf", "Gestión de valores UF del módulo arriendos", "/api/arriendos/uf", "manage"),
    ]

    for perm_name, description, resource, action in permissions:
        cursor.execute(
            "INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES (?, ?, ?, ?)",
            (perm_name, description, resource, action),
        )
        cursor.execute("SELECT id FROM permissions WHERE name = ?", (perm_name,))
        row = cursor.fetchone()
        if row:
            cursor.execute(
                "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                (admin_role_id, int(row[0])),
            )

    conn.commit()


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
