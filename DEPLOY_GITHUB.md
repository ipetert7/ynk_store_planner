# Deploy en Producción desde GitHub

Guía completa para hacer deploy del proyecto YNK Modelo en un servidor de producción usando Docker, directamente desde un repositorio de GitHub.

## 📋 Tabla de Contenidos

- [Prerrequisitos](#prerrequisitos)
- [Paso 1: Crear Repositorio en GitHub](#paso-1-crear-repositorio-en-github)
- [Paso 2: Preparar el Servidor](#paso-2-preparar-el-servidor)
- [Paso 3: Clonar y Configurar](#paso-3-clonar-y-configurar)
- [Paso 4: Configurar Variables de Entorno](#paso-4-configurar-variables-de-entorno)
- [Paso 5: Ejecutar Migraciones](#paso-5-ejecutar-migraciones)
- [Paso 6: Deploy con Docker](#paso-6-deploy-con-docker)
- [Paso 7: Configurar Servicio Systemd (Opcional)](#paso-7-configurar-servicio-systemd-opcional)
- [Paso 8: Actualizar desde GitHub](#paso-8-actualizar-desde-github)
- [Solución de Problemas](#solución-de-problemas)

---

## Prerrequisitos

- Servidor con Rocky Linux 8.9 (o similar)
- Acceso SSH al servidor con permisos de sudo
- Repositorio GitHub creado (ver Paso 1)
- Dominio o IP pública del servidor (opcional, para acceso externo)

---

## Paso 1: Crear Repositorio en GitHub

### 1.1 Crear Nuevo Repositorio

1. Ve a [GitHub](https://github.com) e inicia sesión
2. Click en el botón **"+"** en la esquina superior derecha
3. Selecciona **"New repository"**
4. Completa el formulario:
   - **Repository name**: `ynk-modelo` (o el nombre que prefieras)
   - **Description**: "YNK Modelo - Generador de reportes EERR y simulador EBITDA"
   - **Visibility**: Private (recomendado) o Public
   - **NO** marques "Initialize with README" (si ya tienes código local)
5. Click en **"Create repository"**

### 1.2 Subir Código al Repositorio

Desde tu máquina local:

```bash
# Navegar al directorio del proyecto
cd /ruta/a/ynk-modelo

# Inicializar git (si no está inicializado)
git init

# Agregar archivos (excluyendo los que no deben subirse)
git add .

# Crear commit inicial
git commit -m "Initial commit: YNK Modelo project"

# Agregar el repositorio remoto (reemplaza USERNAME con tu usuario de GitHub)
git remote add origin https://github.com/USERNAME/ynk-modelo.git

# Subir código
git branch -M main
git push -u origin main
```

**Nota:** Asegúrate de tener un `.gitignore` que excluya:

- `data/*.xlsx` (archivos de datos sensibles)
- `data/ynk_users.db` (base de datos)
- `.env` (variables de entorno)
- `logs/`
- `output/`
- `__pycache__/`
- `*.pyc`

### 1.3 Crear .gitignore (si no existe)

```bash
# Crear .gitignore
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
*.egg-info/
dist/
build/

# Entorno
.env
.venv
env/
venv/

# Datos sensibles
data/*.xlsx
data/ynk_users.db
data/*.db

# Logs
logs/*.log

# Output
output/*.html
output/*.xlsx

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF

# Agregar y commitear
git add .gitignore
git commit -m "Add .gitignore"
git push
```

---

## Paso 2: Preparar el Servidor

### 2.1 Conectar al Servidor

```bash
# Desde tu máquina local
ssh usuario@IP_DEL_SERVIDOR
```

### 2.2 Actualizar el Sistema

```bash
sudo dnf update -y
```

### 2.3 Instalar Docker y Docker Compose

```bash
# Instalar Docker
sudo dnf install -y docker docker-compose

# Habilitar Docker al inicio
sudo systemctl enable docker

# Iniciar Docker
sudo systemctl start docker

# Verificar instalación
docker --version
docker compose version
```

### 2.4 Instalar Git (si no está instalado)

```bash
sudo dnf install -y git
```

### 2.5 Configurar Firewall (si es necesario)

```bash
# Permitir puerto 8000 (o el que uses)
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload

# Verificar
sudo firewall-cmd --list-ports
```

---

## Paso 3: Clonar y Configurar

### 3.1 Crear Directorio para el Proyecto

```bash
# Crear directorio (ajusta la ruta según tu preferencia)
sudo mkdir -p /opt/ynk-modelo
sudo chown $USER:$USER /opt/ynk-modelo
cd /opt/ynk-modelo
```

### 3.2 Clonar el Repositorio

```bash
# Clonar desde GitHub (reemplaza USERNAME y REPO)
git clone https://github.com/USERNAME/ynk-modelo.git .

# O si usas SSH:
# git clone git@github.com:USERNAME/ynk-modelo.git .
```

### 3.3 Verificar Archivos

```bash
# Ver estructura del proyecto
ls -la

# Verificar que los scripts tengan permisos
chmod +x scripts/*.sh
```

---

## Paso 4: Configurar Variables de Entorno

### 4.1 Crear Archivo .env

```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar con tus valores
nano .env
```

### 4.2 Configuración Recomendada para Producción

```env
# Ambiente
ENVIRONMENT=prod

# Puerto
PORT=8000

# Secret Key (GENERAR UNA NUEVA - ver abajo)
SECRET_KEY=<GENERAR_CLAVE_SEGURA>

# Auto-regeneración
AUTO_REGENERATE=true
CHECK_INTERVAL=300

# Logs
LOG_DIR=logs
```

### 4.3 Generar SECRET_KEY Segura

```bash
# Generar clave secreta
python3 -c "import secrets; print(secrets.token_hex(32))"

# Copiar el resultado y pegarlo en .env como SECRET_KEY
```

**⚠️ IMPORTANTE:** Nunca subas el archivo `.env` a GitHub. Debe estar en `.gitignore`.

---

## Paso 5: Ejecutar Migraciones

### 5.1 Construir la Imagen Docker

```bash
# Construir imagen
./scripts/docker-build.sh
```

### 5.2 Preparar Archivos de Datos

```bash
# Crear directorio de datos si no existe
mkdir -p data

# Subir archivos Excel necesarios (D0-D7) a data/
# Puedes usar scp desde tu máquina local:
# scp data/*.xlsx usuario@IP_DEL_SERVIDOR:/opt/ynk-modelo/data/
```

### 5.3 Inicializar Base de Datos

```bash
# Ejecutar script de inicialización
docker run --rm \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/config:/app/config" \
  -v "$(pwd)/.env:/app/.env" \
  --env-file .env \
  ynk-modelo:latest \
  python3 scripts/init_database.py
```

### 5.4 Crear Usuario Administrador (si no migraste desde users.txt)

```bash
# Acceder a la base de datos
sqlite3 data/ynk_users.db

# Insertar usuario admin (reemplaza 'password_hash' con el hash real)
# Para generar hash: python3 -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('tu_password'))"
INSERT INTO users (username, password_hash, full_name, email, is_active)
VALUES ('admin', 'password_hash_aqui', 'Administrador', 'admin@ynk.cl', 1);

# Asignar rol admin
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'admin';

# Salir
.quit
```

---

## Paso 6: Deploy con Docker

### 6.1 Usar Docker Compose para Producción

```bash
# Iniciar servicios
docker compose -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Verificar estado
docker compose -f docker-compose.prod.yml ps
```

### 6.2 Verificar que el Servicio Esté Funcionando

```bash
# Verificar que el contenedor esté corriendo
docker ps | grep ynk-modelo

# Probar acceso local
curl http://localhost:8000/api/status

# Ver logs en tiempo real
docker logs -f ynk-modelo
```

### 6.3 Acceder al Sistema

Abre tu navegador en:

- **Local**: `http://IP_DEL_SERVIDOR:8000`
- **Con dominio**: `http://tu-dominio.com:8000`

---

## Paso 7: Configurar Servicio Systemd (Opcional)

Para que el servicio se inicie automáticamente al reiniciar el servidor:

### 7.1 Crear Archivo de Servicio

```bash
# Copiar el archivo de servicio
sudo cp deploy/ynk-modelo.service /etc/systemd/system/

# Editar si es necesario
sudo nano /etc/systemd/system/ynk-modelo.service
```

### 7.2 Habilitar y Iniciar Servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar al inicio
sudo systemctl enable ynk-modelo

# Iniciar servicio
sudo systemctl start ynk-modelo

# Verificar estado
sudo systemctl status ynk-modelo

# Ver logs
sudo journalctl -u ynk-modelo -f
```

---

## Paso 8: Actualizar desde GitHub

### 8.1 Actualizar Código

```bash
# Navegar al directorio del proyecto
cd /opt/ynk-modelo

# Obtener últimos cambios
git pull origin main

# Reconstruir imagen Docker
./scripts/docker-build.sh

# Reiniciar contenedor
docker compose -f docker-compose.prod.yml restart
```

### 8.2 Script de Actualización Automática

Puedes crear un script para automatizar el proceso:

```bash
# Crear script de actualización
cat > scripts/update.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Actualizando YNK Modelo desde GitHub..."

# Obtener cambios
git pull origin main

# Reconstruir imagen
echo "🔨 Reconstruyendo imagen Docker..."
./scripts/docker-build.sh

# Reiniciar servicios
echo "🔄 Reiniciando servicios..."
docker compose -f docker-compose.prod.yml restart

echo "✅ Actualización completada"
EOF

# Dar permisos
chmod +x scripts/update.sh
```

Uso:

```bash
./scripts/update.sh
```

---

## Solución de Problemas

### El contenedor no inicia

```bash
# Ver logs detallados
docker logs ynk-modelo

# Verificar configuración
docker compose -f docker-compose.prod.yml config

# Verificar que el puerto no esté en uso
sudo netstat -tulpn | grep 8000
```

### Error de permisos en base de datos

```bash
# Ajustar permisos
sudo chmod 664 data/ynk_users.db
sudo chown $USER:$USER data/ynk_users.db
```

### No puedo acceder desde fuera del servidor

1. Verificar firewall:

```bash
sudo firewall-cmd --list-ports
```

2. Verificar que Docker esté escuchando en todas las interfaces:

```bash
docker ps
# Verificar que el puerto esté mapeado correctamente
```

3. Si usas un proxy reverso (nginx, apache), configurar redirección al puerto 8000

### Los reportes no se generan

1. Verificar que los archivos Excel estén en `data/`:

```bash
ls -la data/*.xlsx
```

2. Verificar permisos:

```bash
ls -la data/
```

3. Ver logs:

```bash
docker logs ynk-modelo | grep -i error
```

### Error al hacer git pull

Si hay conflictos locales:

```bash
# Ver estado
git status

# Si hay cambios locales que quieres descartar
git reset --hard origin/main

# Si quieres guardar cambios locales primero
git stash
git pull
git stash pop
```

---

## Configuración de Nginx como Proxy Reverso (Opcional)

Si quieres usar un dominio y HTTPS:

### Instalar Nginx

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Configurar Nginx

```bash
# Crear configuración
sudo nano /etc/nginx/conf.d/ynk-modelo.conf
```

Contenido:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Probar configuración
sudo nginx -t

# Recargar nginx
sudo systemctl reload nginx
```

---

## Backup y Restauración

### Backup de Base de Datos

```bash
# Crear backup
cp data/ynk_users.db data/ynk_users.db.backup.$(date +%Y%m%d)

# O con compresión
tar -czf backup_$(date +%Y%m%d).tar.gz data/ynk_users.db
```

### Restaurar Backup

```bash
# Detener servicio
docker compose -f docker-compose.prod.yml stop

# Restaurar
cp data/ynk_users.db.backup.20260105 data/ynk_users.db

# Reiniciar
docker compose -f docker-compose.prod.yml start
```

---

## Monitoreo

### Ver Logs en Tiempo Real

```bash
# Logs del contenedor
docker logs -f ynk-modelo

# Logs del sistema (si usas systemd)
sudo journalctl -u ynk-modelo -f
```

### Verificar Salud del Servicio

```bash
# Health check
curl http://localhost:8000/api/status

# Ver uso de recursos
docker stats ynk-modelo
```

### Detector de Cambios Automático

El sistema incluye un detector automático que regenera los reportes cuando detecta cambios en los archivos Excel.

#### ⚡ Inicio Automático

**No necesitas ejecutar ningún comando adicional.** El detector funciona automáticamente una vez que el contenedor Docker está corriendo. Solo necesitas:

1. ✅ Levantar el contenedor: `docker compose -f docker-compose.prod.yml up -d`
2. ✅ Los usuarios acceden a los reportes normalmente

El detector se activa automáticamente cada vez que alguien accede a un reporte HTML.

#### ¿Cómo Funciona?

1. **Detección Automática**: Cada vez que un usuario accede a un reporte HTML, el sistema verifica si hay cambios en los archivos Excel de `data/`.

2. **Regeneración Automática**: Si detecta cambios, regenera los reportes automáticamente antes de mostrarlos.

3. **Sin Interrupciones**: Los usuarios no necesitan hacer nada, el sistema se actualiza automáticamente.

4. **Sin Procesos en Background**: No hay procesos adicionales corriendo. La verificación se hace "on-demand" cuando se accede a las páginas.

#### Verificar Cambios Manualmente

```bash
# Verificar y regenerar si hay cambios (requiere autenticación)
curl -u usuario:password http://localhost:8000/api/check

# Ver estado del sistema y archivos monitoreados
curl -u usuario:password http://localhost:8000/api/status
```

#### Ver Logs del Detector

```bash
# Ver logs en tiempo real
docker logs -f ynk-modelo | grep -i "cambio\|regenera"

# Ejemplo de salida cuando detecta cambios:
# 2026-01-05 19:37:43 | INFO | ¡CAMBIOS DETECTADOS! Regenerando reportes...
# 2026-01-05 19:37:43 | INFO |   • D3_Dotacion.xlsx (modificado 2026-01-05 19:37:34)
# 2026-01-05 19:37:44 | INFO | ✓ REPORTES REGENERADOS EXITOSAMENTE
```

#### Configuración

El detector está **habilitado por defecto** y **no requiere configuración adicional**. Solo asegúrate de que `AUTO_REGENERATE=true` en tu `.env` (que es el valor por defecto):

```env
# Habilitar auto-regeneración (por defecto: true)
AUTO_REGENERATE=true
```

**Nota**: Si deshabilitas `AUTO_REGENERATE=false`, el detector dejará de funcionar.

#### Archivos Monitoreados

El sistema monitorea automáticamente todos los archivos D0-D7 en `data/`:

- `D0_Diccionario tiendas.xlsx`
- `D1_Venta y Contribucion.xlsx`
- `D2_Arriendos.xlsx`
- `D3_Dotacion.xlsx`
- `D4_Redes.xlsx`
- `D5_Medio de pago.xlsx`
- `D6_Otros costos.xlsx`
- `D7_UF.xlsx`

**Nota**: Los archivos temporales de Excel (que empiezan con `~$`) son excluidos automáticamente.

---

## Seguridad

### Recomendaciones

1. **Cambiar SECRET_KEY** en producción
2. **Usar HTTPS** con certificado SSL
3. **Configurar firewall** para limitar acceso
4. **Hacer backups regulares** de la base de datos
5. **Mantener el sistema actualizado**: `sudo dnf update`
6. **No subir archivos sensibles** a GitHub (.env, datos, etc.)

---

## Soporte

Para más información o soporte, contacta al equipo de desarrollo.

---

**Última actualización:** Enero 2026
