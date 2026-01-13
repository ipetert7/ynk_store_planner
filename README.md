# YNK Modelo - Generador de Reportes EERR y Simulador EBITDA

Sistema web para generar estados de resultados (EERR) y simulador EBITDA para tiendas Yáneken. Incluye autenticación basada en roles y permisos, gestión de usuarios, y generación automática de reportes HTML.

## 📋 Tabla de Contenidos

- [Requisitos del Sistema](#requisitos-del-sistema)
- [Instalación desde Cero](#instalación-desde-cero)
  - [macOS](#instalación-en-macos)
  - [Rocky Linux 8.9](#instalación-en-rocky-linux-89)
- [Configuración del Proyecto](#configuración-del-proyecto)
- [Migraciones de Base de Datos](#migraciones-de-base-de-datos)
- [Ejecutar el Proyecto](#ejecutar-el-proyecto)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Uso del Sistema](#uso-del-sistema)

---

## Requisitos del Sistema

- **Docker** 20.10 o superior
- **Docker Compose** 2.0 o superior
- **Git** (para clonar el repositorio)
- **Python 3.10+** (solo si ejecutas sin Docker)
- **SQLite 3** (incluido en la mayoría de sistemas)

---

## Instalación desde Cero

### Instalación en macOS

#### 1. Instalar Docker Desktop

1. Descarga Docker Desktop desde: https://www.docker.com/products/docker-desktop
2. Abre el archivo `.dmg` descargado
3. Arrastra Docker a la carpeta Applications
4. Abre Docker Desktop desde Applications
5. Acepta los términos y condiciones
6. Espera a que Docker se inicie (verás el ícono de Docker en la barra de menú)

**Verificar instalación:**

```bash
docker --version
docker compose version
```

#### 2. Clonar el Repositorio

```bash
# Navegar al directorio donde quieres el proyecto
cd ~/proyectos

# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO> ynk-modelo
cd ynk-modelo
```

#### 3. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar .env con tus valores (opcional, los valores por defecto funcionan para desarrollo)
nano .env
```

**Variables importantes en `.env`:**

- `ENVIRONMENT=local` - Ambiente local o producción
- `PORT=8000` - Puerto del servidor
- `SECRET_KEY` - Cambiar en producción (generar con: `python3 -c "import secrets; print(secrets.token_hex(32))"`)

#### 4. Construir la Imagen Docker

```bash
# Dar permisos de ejecución a los scripts
chmod +x scripts/*.sh

# Construir la imagen
./scripts/docker-build.sh
```

#### 5. Inicializar Base de Datos

```bash
# Ejecutar migraciones e inicializar base de datos
docker run --rm \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/config:/app/config" \
  ynk-modelo:latest \
  python3 scripts/init_database.py
```

**Nota:** Si tienes usuarios en `config/users.txt`, estos se migrarán automáticamente a la base de datos.

#### 6. Ejecutar el Proyecto

```bash
# Iniciar el contenedor
./scripts/docker-run.sh
```

El servidor estará disponible en: **http://localhost:8000**

---

### Instalación en Rocky Linux 8.9

#### 1. Instalar Docker y Docker Compose

```bash
# Actualizar sistema
sudo dnf update -y

# Instalar Docker
sudo dnf install -y docker docker-compose

# Habilitar Docker al inicio
sudo systemctl enable docker

# Iniciar Docker
sudo systemctl start docker

# Verificar instalación
docker --version
docker compose version

# Agregar tu usuario al grupo docker (opcional, para no usar sudo)
sudo usermod -aG docker $USER
# Nota: Necesitas cerrar sesión y volver a entrar para que tome efecto
```

#### 2. Instalar Git (si no está instalado)

```bash
sudo dnf install -y git
```

#### 3. Clonar el Repositorio

```bash
# Navegar al directorio donde quieres el proyecto
cd /opt  # o el directorio que prefieras

# Clonar el repositorio
sudo git clone <URL_DEL_REPOSITORIO> ynk-modelo
cd ynk-modelo

# Ajustar permisos (si es necesario)
sudo chown -R $USER:$USER .
```

#### 4. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar .env para producción
nano .env
```

**Configuración recomendada para producción:**

```env
ENVIRONMENT=prod
PORT=8000
SECRET_KEY=<GENERAR_UNA_CLAVE_SECRETA_SEGURA>
AUTO_REGENERATE=true
CHECK_INTERVAL=300
```

**Generar SECRET_KEY:**

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

#### 5. Construir la Imagen Docker

```bash
# Dar permisos de ejecución
chmod +x scripts/*.sh

# Construir la imagen
./scripts/docker-build.sh
```

#### 6. Inicializar Base de Datos

```bash
# Ejecutar migraciones
docker run --rm \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/config:/app/config" \
  ynk-modelo:latest \
  python3 scripts/init_database.py
```

#### 7. Ejecutar el Proyecto en Producción

```bash
# Usar docker-compose para producción
docker compose -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Verificar estado
docker compose -f docker-compose.prod.yml ps
```

El servidor estará disponible en: **http://localhost:8000** (o el puerto configurado)

---

## Configuración del Proyecto

### Estructura de Directorios

```
ynk-modelo/
├── data/              # Archivos Excel de entrada (D0-D7)
├── output/            # Reportes HTML generados
├── logs/              # Logs del sistema
├── config/            # Configuración (users.txt, etc.)
├── src/               # Código fuente Python
├── templates/         # Plantillas HTML
├── static/            # Archivos estáticos (CSS, imágenes)
├── scripts/           # Scripts auxiliares
└── deploy/            # Scripts de deployment
```

### Archivos de Datos Requeridos

El proyecto requiere los siguientes archivos Excel en `data/`:

- `D0_Diccionario tiendas.xlsx` - Diccionario de tiendas
- `D1_Venta y Contribucion.xlsx` - Ventas y contribución
- `D2_Arriendos.xlsx` - Información de arriendos
- `D3_Dotacion.xlsx` - Dotación de personal
- `D4_Redes.xlsx` - Información de redes
- `D5_Medio de pago.xlsx` - Medios de pago
- `D6_Otros costos.xlsx` - Otros costos
- `D7_UF.xlsx` - Valores de UF

---

## Migraciones de Base de Datos

### Inicializar Base de Datos por Primera Vez

```bash
# Con Docker
docker run --rm \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/config:/app/config" \
  ynk-modelo:latest \
  python3 scripts/init_database.py
```

Este script:

- Crea las tablas necesarias (users, roles, permissions, etc.)
- Crea el rol "admin" con todos los permisos
- Migra usuarios desde `config/users.txt` (si existe)

### Crear Base de Datos desde SQL (Producción)

```bash
# Si prefieres usar SQL directamente
sqlite3 data/ynk_users.db < scripts/create_database.sql
```

### Migrar Usuarios desde config/users.txt

El formato de `config/users.txt` es:

```
username:password:full_name:email
```

Ejemplo:

```
admin:admin123:Administrador:admin@ynk.cl
usuario1:pass123:Usuario Uno:usuario1@ynk.cl
```

**Nota:** Los usuarios migrados tendrán el rol "admin" por defecto. Puedes cambiar los roles después desde la interfaz web.

---

## Ejecutar el Proyecto

### Desarrollo Local (macOS)

```bash
# Iniciar contenedor
./scripts/docker-run.sh

# Ver logs
docker logs -f ynk-modelo

# Detener contenedor
docker stop ynk-modelo

# Reiniciar contenedor
docker restart ynk-modelo
```

### Producción (Rocky Linux)

```bash
# Iniciar con docker-compose
docker compose -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Detener
docker compose -f docker-compose.prod.yml down

# Reiniciar
docker compose -f docker-compose.prod.yml restart
```

### Acceso al Sistema

1. Abre tu navegador en: `http://localhost:8000`
2. Serás redirigido al login
3. Inicia sesión con un usuario que tenga el rol "admin"
4. Accede al dashboard y módulos según tus permisos

---

## Detector de Cambios Automático

El sistema incluye un detector automático de cambios que regenera los reportes cuando detecta modificaciones en los archivos Excel de `data/`.

### ⚡ Inicio Automático

**No necesitas ejecutar ningún comando adicional.** El detector funciona automáticamente una vez que el contenedor Docker está corriendo. Solo necesitas:

1. ✅ Levantar el contenedor: `./scripts/docker-run.sh`
2. ✅ Acceder a los reportes en el navegador

El detector se activa automáticamente cada vez que alguien accede a un reporte HTML.

### ¿Cómo Funciona?

1. **Detección Automática**: Cada vez que accedes a un reporte HTML (`EERR_por_tienda.html` o `Simulador_EERR.html`), el sistema verifica si hay cambios en los archivos Excel.

2. **Regeneración Automática**: Si detecta cambios, regenera los reportes automáticamente antes de mostrarlos.

3. **Monitoreo de Archivos**: Solo monitorea archivos de datos (D0-D7) y excluye archivos temporales de Excel.

4. **Sin Procesos en Background**: No hay procesos adicionales corriendo. La verificación se hace "on-demand" cuando se accede a las páginas.

### Configuración

El detector está **habilitado por defecto** y **no requiere configuración adicional**. Solo asegúrate de que `AUTO_REGENERATE=true` en tu `.env` (que es el valor por defecto):

```env
# Habilitar auto-regeneración (por defecto: true)
AUTO_REGENERATE=true
```

**Nota**: Si deshabilitas `AUTO_REGENERATE=false`, el detector dejará de funcionar.

### Probar el Detector

1. **Modificar un archivo Excel**:

   ```bash
   # Abre y modifica cualquier archivo en data/
   # Por ejemplo: data/D3_Dotacion.xlsx
   ```

2. **Acceder a un reporte**:

   - Abre: `http://localhost:8000/EERR_por_tienda.html`
   - O: `http://localhost:8000/Simulador_EERR.html`

3. **Verificar en logs**:

   ```bash
   docker logs -f ynk-modelo
   ```

   Deberías ver algo como:

   ```
   2026-01-05 19:37:43 | INFO | ¡CAMBIOS DETECTADOS! Regenerando reportes...
   2026-01-05 19:37:43 | INFO |   • D3_Dotacion.xlsx (modificado 2026-01-05 19:37:34)
   2026-01-05 19:37:44 | INFO | ✓ REPORTES REGENERADOS EXITOSAMENTE
   ```

### Verificación Manual

También puedes verificar cambios manualmente usando la API:

```bash
# Verificar y regenerar si hay cambios
curl http://localhost:8000/api/check

# Ver estado del sistema y archivos monitoreados
curl http://localhost:8000/api/status
```

**Nota**: Requiere autenticación. Debes estar logueado para usar estos endpoints.

### Archivos Monitoreados

El sistema monitorea automáticamente:

- `D0_Diccionario tiendas.xlsx`
- `D1_Venta y Contribucion.xlsx`
- `D2_Arriendos.xlsx`
- `D3_Dotacion.xlsx`
- `D4_Redes.xlsx`
- `D5_Medio de pago.xlsx`
- `D6_Otros costos.xlsx`
- `D7_UF.xlsx`

**Archivos excluidos**:

- Archivos temporales de Excel (que empiezan con `~$`)
- Cualquier otro archivo que no sea D0-D7

---

## Estructura del Proyecto

### Módulos Principales

- **EERR Report**: Visualización de estados de resultados por tienda
- **Simulador EERR**: Herramienta para simular escenarios
- **Gestión de Usuarios**: Administración de usuarios del sistema
- **Gestión de Roles**: Crear y gestionar roles
- **Gestión de Permisos**: Crear y gestionar permisos

### Permisos del Sistema

- `access_admin_users` - Acceso a gestión de usuarios
- `access_eerr_report` - Acceso a reporte EERR
- `access_simulator` - Acceso a simulador

### Roles por Defecto

- **admin**: Tiene todos los permisos del sistema

---

## Uso del Sistema

### Crear un Nuevo Usuario

1. Inicia sesión como administrador
2. Ve a "Gestión de Usuarios"
3. Click en "+ Nuevo Usuario"
4. Completa el formulario y asigna roles
5. Guarda

### Crear un Nuevo Rol

1. Ve a "Gestión de Roles"
2. Click en "+ Nuevo Rol"
3. Asigna permisos al rol
4. Guarda

### Crear un Nuevo Permiso

1. Ve a "Gestión de Permisos"
2. Click en "+ Nuevo Permiso"
3. Completa nombre, descripción, recurso y acción
4. Guarda

### Asignar Permisos a un Rol

1. Ve a "Gestión de Roles"
2. Edita el rol deseado
3. Selecciona los permisos que quieres asignar
4. Guarda

### Asignar Roles a un Usuario

1. Ve a "Gestión de Usuarios"
2. Edita el usuario deseado
3. Selecciona los roles que quieres asignar
4. Guarda

---

## Comandos Útiles

### Docker

```bash
# Ver logs del contenedor
docker logs -f ynk-modelo

# Entrar al contenedor
docker exec -it ynk-modelo /bin/bash

# Ver estado del contenedor
docker ps | grep ynk-modelo

# Reconstruir imagen
./scripts/docker-build.sh

# Ver uso de recursos
docker stats ynk-modelo
```

### Base de Datos

```bash
# Acceder a la base de datos SQLite
sqlite3 data/ynk_users.db

# Backup de la base de datos
cp data/ynk_users.db data/ynk_users.db.backup

# Restaurar backup
cp data/ynk_users.db.backup data/ynk_users.db
```

---

## Solución de Problemas

### El contenedor no inicia

```bash
# Ver logs detallados
docker logs ynk-modelo

# Verificar que el puerto no esté en uso
lsof -i :8000  # macOS
netstat -tulpn | grep 8000  # Linux
```

### Error de permisos en la base de datos

```bash
# Ajustar permisos
chmod 664 data/ynk_users.db
chmod 775 data/
```

### Los reportes no se generan

1. Verifica que los archivos Excel estén en `data/`
2. Verifica los logs: `docker logs ynk-modelo`
3. Verifica permisos de lectura en `data/`

### No puedo iniciar sesión

1. Verifica que la base de datos esté inicializada
2. Verifica que exista un usuario con el rol "admin"
3. Revisa los logs del servidor

---

## Soporte

Para más información o soporte, contacta al equipo de desarrollo.

---

## Licencia

Propietario - Yáneken
