# Sistema de Gestión de Usuarios - YNK Modelo

Este documento describe el sistema de gestión de usuarios con roles y permisos implementado con SQLite.

## Estructura de la Base de Datos

### Tablas

1. **users**: Almacena información de usuarios
   - `id`: ID único
   - `username`: Nombre de usuario (único)
   - `password_hash`: Hash de la contraseña (usando werkzeug)
   - `full_name`: Nombre completo
   - `email`: Email (opcional)
   - `is_active`: Estado activo/inactivo
   - `created_at`, `updated_at`: Timestamps

2. **roles**: Define los roles del sistema
   - `id`: ID único
   - `name`: Nombre del rol (único)
   - `description`: Descripción del rol

3. **permissions**: Define los permisos disponibles
   - `id`: ID único
   - `name`: Nombre del permiso (único)
   - `description`: Descripción
   - `resource`: Recurso (reports, users, etc.)
   - `action`: Acción (view, manage, etc.)

4. **user_roles**: Relación muchos-a-muchos entre usuarios y roles
   - `user_id`: ID del usuario
   - `role_id`: ID del rol

5. **role_permissions**: Relación muchos-a-muchos entre roles y permisos
   - `role_id`: ID del rol
   - `permission_id`: ID del permiso

## Roles y Permisos por Defecto

### Roles

- **admin**: Administrador con acceso completo
- **viewer**: Visualizador con acceso de solo lectura
- **editor**: Editor con permisos de edición limitados

### Permisos

- `view_reports`: Ver reportes EERR
- `view_simulator`: Ver simulador
- `manage_users`: Gestionar usuarios
- `manage_roles`: Gestionar roles
- `regenerate_reports`: Regenerar reportes
- `export_data`: Exportar datos

### Asignación de Permisos a Roles

- **admin**: Todos los permisos
- **viewer**: `view_reports`, `view_simulator`
- **editor**: `view_reports`, `view_simulator`, `regenerate_reports`

## Inicialización

### Desarrollo Local

```bash
# Inicializar base de datos
python3 scripts/init_database.py

# O usando el módulo directamente
python3 -c "from ynk_modelo.database import init_db, migrate_users_from_config; init_db(); migrate_users_from_config()"
```

### Producción (Rocky Linux)

#### Opción 1: Usando Python

```bash
python3 scripts/init_database.py
```

#### Opción 2: Usando SQL directamente

```bash
# Crear directorio si no existe
mkdir -p data

# Ejecutar script SQL
sqlite3 data/ynk_users.db < scripts/create_database.sql
```

## Uso del Sistema

### Acceso a Gestión de Usuarios

1. Inicia sesión con un usuario que tenga el permiso `manage_users` (rol `admin`)
2. Accede a: `http://localhost:8000/admin/users`

### Crear Usuario

1. Haz clic en "Nuevo Usuario"
2. Completa el formulario:
   - **Usuario**: Nombre de usuario único
   - **Nombre Completo**: Nombre completo del usuario
   - **Email**: (Opcional)
   - **Contraseña**: Contraseña del usuario
   - **Roles**: Selecciona uno o más roles
3. Haz clic en "Crear Usuario"

### Editar Usuario

1. En la lista de usuarios, haz clic en "Editar"
2. Modifica los campos necesarios
3. Para cambiar la contraseña, ingresa una nueva (deja vacío para mantener la actual)
4. Modifica los roles asignados
5. Activa/desactiva el usuario con el checkbox
6. Haz clic en "Guardar Cambios"

### Eliminar Usuario

1. En la lista de usuarios, haz clic en "Eliminar"
2. Confirma la eliminación

**Nota**: No puedes eliminar tu propio usuario.

## Migración desde config/users.txt

El sistema puede migrar usuarios desde el archivo `config/users.txt` si existe. El formato es:

```
usuario:contraseña:Nombre Completo:rol
```

Ejemplo:
```
admin:ynk2025:Administrador:admin
viewer:viewer2025:Visualizador:viewer
```

La migración se ejecuta automáticamente al inicializar la base de datos si el archivo existe.

## Uso en el Código

### Verificar Permisos

```python
from flask_login import current_user

# Verificar si el usuario tiene un permiso
if current_user.has_permission("manage_users"):
    # Hacer algo
    pass

# Verificar si el usuario tiene un rol
if current_user.has_role("admin"):
    # Hacer algo
    pass
```

### Decorador de Permisos

```python
from ynk_modelo.cli.flask_server import permission_required

@app.route("/admin/users")
@permission_required("manage_users")
def admin_users():
    # Solo usuarios con permiso manage_users pueden acceder
    pass
```

## Ubicación de la Base de Datos

La base de datos SQLite se almacena en:
- **Ruta**: `data/ynk_users.db`
- **Relativo al proyecto**: `./data/ynk_users.db`

## Seguridad

- Las contraseñas se almacenan como hash usando `werkzeug.security.generate_password_hash`
- Los usuarios inactivos no pueden iniciar sesión
- Los permisos se verifican en cada solicitud
- Las relaciones en la base de datos usan CASCADE para mantener integridad

## Resolución de Problemas

### La base de datos no se crea

```bash
# Verificar permisos del directorio data/
ls -la data/

# Crear directorio manualmente
mkdir -p data
chmod 755 data
```

### Error al migrar usuarios

Verifica que el archivo `config/users.txt` tenga el formato correcto:
- Formato: `usuario:contraseña:nombre:rol`
- Sin espacios alrededor de los dos puntos
- El rol debe existir en la base de datos

### Usuario no puede iniciar sesión

1. Verifica que el usuario esté activo (`is_active = 1`)
2. Verifica que la contraseña sea correcta
3. Revisa los logs del servidor para más detalles

## Backup

Para hacer backup de la base de datos:

```bash
# Copiar el archivo
cp data/ynk_users.db data/ynk_users.db.backup

# O con timestamp
cp data/ynk_users.db "data/ynk_users_$(date +%Y%m%d_%H%M%S).db"
```

## Restaurar

```bash
# Restaurar desde backup
cp data/ynk_users.db.backup data/ynk_users.db
```
