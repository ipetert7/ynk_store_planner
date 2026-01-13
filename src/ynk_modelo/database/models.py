"""Modelos de datos para usuarios, roles y permisos."""
from __future__ import annotations

from typing import Any
from werkzeug.security import check_password_hash, generate_password_hash

from ynk_modelo.database.db import get_db


class User:
    """Modelo de usuario."""
    
    def __init__(
        self,
        id: int,
        username: str,
        password_hash: str,
        full_name: str,
        email: str | None = None,
        is_active: bool = True,
    ):
        self.id = id
        self.username = username
        self.password_hash = password_hash
        self.full_name = full_name
        self.email = email
        self.is_active = is_active
    
    def check_password(self, password: str) -> bool:
        """Verifica si la contraseña es correcta."""
        return check_password_hash(self.password_hash, password)
    
    def set_password(self, password: str) -> None:
        """Establece una nueva contraseña."""
        self.password_hash = generate_password_hash(password)
    
    @classmethod
    def get_by_username(cls, username: str) -> User | None:
        """Obtiene un usuario por nombre de usuario."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, full_name, email, is_active FROM users WHERE username = ?",
            (username,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return cls(
                id=row[0],
                username=row[1],
                password_hash=row[2],
                full_name=row[3],
                email=row[4],
                is_active=bool(row[5]),
            )
        return None
    
    @classmethod
    def get_by_id(cls, user_id: int) -> User | None:
        """Obtiene un usuario por ID."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, full_name, email, is_active FROM users WHERE id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return cls(
                id=row[0],
                username=row[1],
                password_hash=row[2],
                full_name=row[3],
                email=row[4],
                is_active=bool(row[5]),
            )
        return None
    
    @classmethod
    def create(
        cls,
        username: str,
        password: str,
        full_name: str,
        email: str | None = None,
    ) -> User:
        """Crea un nuevo usuario."""
        conn = get_db()
        cursor = conn.cursor()
        
        password_hash = generate_password_hash(password)
        cursor.execute(
            """INSERT INTO users (username, password_hash, full_name, email, is_active)
               VALUES (?, ?, ?, ?, 1)""",
            (username, password_hash, full_name, email)
        )
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return cls(
            id=user_id,
            username=username,
            password_hash=password_hash,
            full_name=full_name,
            email=email,
            is_active=True,
        )
    
    def update(self) -> None:
        """Actualiza el usuario en la base de datos."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE users 
               SET username = ?, password_hash = ?, full_name = ?, email = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (self.username, self.password_hash, self.full_name, self.email, 1 if self.is_active else 0, self.id)
        )
        conn.commit()
        conn.close()
    
    def delete(self) -> None:
        """Elimina el usuario de la base de datos."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (self.id,))
        conn.commit()
        conn.close()
    
    def get_roles(self) -> list[str]:
        """Obtiene los roles del usuario."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT r.name 
               FROM roles r
               INNER JOIN user_roles ur ON r.id = ur.role_id
               WHERE ur.user_id = ?""",
            (self.id,)
        )
        roles = [row[0] for row in cursor.fetchall()]
        conn.close()
        return roles
    
    def has_permission(self, permission_name: str) -> bool:
        """Verifica si el usuario tiene un permiso específico."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT COUNT(*) 
               FROM permissions p
               INNER JOIN role_permissions rp ON p.id = rp.permission_id
               INNER JOIN user_roles ur ON rp.role_id = ur.role_id
               WHERE ur.user_id = ? AND p.name = ?""",
            (self.id, permission_name)
        )
        count = cursor.fetchone()[0]
        conn.close()
        return count > 0
    
    def has_role(self, role_name: str) -> bool:
        """Verifica si el usuario tiene un rol específico."""
        return role_name in self.get_roles()
    
    @classmethod
    def list_all(cls) -> list[User]:
        """Lista todos los usuarios."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash, full_name, email, is_active FROM users ORDER BY username"
        )
        users = [
            cls(
                id=row[0],
                username=row[1],
                password_hash=row[2],
                full_name=row[3],
                email=row[4],
                is_active=bool(row[5]),
            )
            for row in cursor.fetchall()
        ]
        conn.close()
        return users


class Role:
    """Modelo de rol."""
    
    def __init__(self, id: int, name: str, description: str | None = None):
        self.id = id
        self.name = name
        self.description = description
    
    @classmethod
    def get_by_name(cls, name: str) -> Role | None:
        """Obtiene un rol por nombre."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description FROM roles WHERE name = ?", (name,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return cls(id=row[0], name=row[1], description=row[2])
        return None
    
    @classmethod
    def list_all(cls) -> list[Role]:
        """Lista todos los roles."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description FROM roles ORDER BY name")
        roles = [
            cls(id=row[0], name=row[1], description=row[2])
            for row in cursor.fetchall()
        ]
        conn.close()
        return roles
    
    def get_permissions(self) -> list[str]:
        """Obtiene los permisos del rol."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT p.name 
               FROM permissions p
               INNER JOIN role_permissions rp ON p.id = rp.permission_id
               WHERE rp.role_id = ?""",
            (self.id,)
        )
        permissions = [row[0] for row in cursor.fetchall()]
        conn.close()
        return permissions
    
    def get_permission_ids(self) -> list[int]:
        """Obtiene los IDs de los permisos del rol."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT p.id 
               FROM permissions p
               INNER JOIN role_permissions rp ON p.id = rp.permission_id
               WHERE rp.role_id = ?""",
            (self.id,)
        )
        permission_ids = [row[0] for row in cursor.fetchall()]
        conn.close()
        return permission_ids
    
    @classmethod
    def get_by_id(cls, role_id: int) -> Role | None:
        """Obtiene un rol por ID."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description FROM roles WHERE id = ?", (role_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return cls(id=row[0], name=row[1], description=row[2])
        return None
    
    @classmethod
    def create(cls, name: str, description: str | None = None) -> Role:
        """Crea un nuevo rol."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO roles (name, description) VALUES (?, ?)",
            (name, description)
        )
        role_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return cls(id=role_id, name=name, description=description)
    
    def update(self) -> None:
        """Actualiza el rol en la base de datos."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE roles SET name = ?, description = ? WHERE id = ?",
            (self.name, self.description, self.id)
        )
        conn.commit()
        conn.close()
    
    def delete(self) -> None:
        """Elimina el rol de la base de datos."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM roles WHERE id = ?", (self.id,))
        conn.commit()
        conn.close()
    
    def set_permissions(self, permission_ids: list[int]) -> None:
        """Establece los permisos del rol (reemplaza los existentes)."""
        conn = get_db()
        cursor = conn.cursor()
        
        # Eliminar permisos actuales
        cursor.execute("DELETE FROM role_permissions WHERE role_id = ?", (self.id,))
        
        # Asignar nuevos permisos
        for perm_id in permission_ids:
            cursor.execute(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                (self.id, perm_id)
            )
        
        conn.commit()
        conn.close()


class Permission:
    """Modelo de permiso."""
    
    def __init__(
        self,
        id: int,
        name: str,
        description: str | None = None,
        resource: str | None = None,
        action: str | None = None,
    ):
        self.id = id
        self.name = name
        self.description = description
        self.resource = resource
        self.action = action
    
    @classmethod
    def get_by_id(cls, permission_id: int) -> Permission | None:
        """Obtiene un permiso por ID."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, description, resource, action FROM permissions WHERE id = ?",
            (permission_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return cls(
                id=row[0],
                name=row[1],
                description=row[2],
                resource=row[3],
                action=row[4],
            )
        return None
    
    @classmethod
    def get_by_name(cls, name: str) -> Permission | None:
        """Obtiene un permiso por nombre."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, description, resource, action FROM permissions WHERE name = ?",
            (name,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return cls(
                id=row[0],
                name=row[1],
                description=row[2],
                resource=row[3],
                action=row[4],
            )
        return None
    
    @classmethod
    def list_all(cls) -> list[Permission]:
        """Lista todos los permisos."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, description, resource, action FROM permissions ORDER BY resource, action"
        )
        permissions = [
            cls(
                id=row[0],
                name=row[1],
                description=row[2],
                resource=row[3],
                action=row[4],
            )
            for row in cursor.fetchall()
        ]
        conn.close()
        return permissions
    
    @classmethod
    def create(
        cls,
        name: str,
        description: str | None = None,
        resource: str | None = None,
        action: str | None = None,
    ) -> Permission:
        """Crea un nuevo permiso."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO permissions (name, description, resource, action) VALUES (?, ?, ?, ?)",
            (name, description, resource, action)
        )
        permission_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return cls(
            id=permission_id,
            name=name,
            description=description,
            resource=resource,
            action=action,
        )
    
    def update(self) -> None:
        """Actualiza el permiso en la base de datos."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE permissions SET name = ?, description = ?, resource = ?, action = ? WHERE id = ?",
            (self.name, self.description, self.resource, self.action, self.id)
        )
        conn.commit()
        conn.close()
    
    def delete(self) -> None:
        """Elimina el permiso de la base de datos."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM permissions WHERE id = ?", (self.id,))
        conn.commit()
        conn.close()


class UserRole:
    """Modelo de relación usuario-rol."""
    
    @staticmethod
    def assign(user_id: int, role_id: int) -> None:
        """Asigna un rol a un usuario."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)",
            (user_id, role_id)
        )
        conn.commit()
        conn.close()
    
    @staticmethod
    def remove(user_id: int, role_id: int) -> None:
        """Remueve un rol de un usuario."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?",
            (user_id, role_id)
        )
        conn.commit()
        conn.close()
    
    @staticmethod
    def set_user_roles(user_id: int, role_ids: list[int]) -> None:
        """Establece los roles de un usuario (reemplaza los existentes)."""
        conn = get_db()
        cursor = conn.cursor()
        
        # Eliminar roles actuales
        cursor.execute("DELETE FROM user_roles WHERE user_id = ?", (user_id,))
        
        # Asignar nuevos roles
        for role_id in role_ids:
            cursor.execute(
                "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
                (user_id, role_id)
            )
        
        conn.commit()
        conn.close()


class RolePermission:
    """Modelo de relación rol-permiso."""
    
    @staticmethod
    def assign(role_id: int, permission_id: int) -> None:
        """Asigna un permiso a un rol."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
            (role_id, permission_id)
        )
        conn.commit()
        conn.close()
    
    @staticmethod
    def remove(role_id: int, permission_id: int) -> None:
        """Remueve un permiso de un rol."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?",
            (role_id, permission_id)
        )
        conn.commit()
        conn.close()
