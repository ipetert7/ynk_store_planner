# Guía de Docker - YNK Modelo

Esta guía explica cómo ejecutar el proyecto YNK Modelo usando Docker en Mac (desarrollo local) y Rocky Linux 8.9 (producción).

## Requisitos Previos

### Mac (Local)
- Docker Desktop instalado ([descargar](https://www.docker.com/products/docker-desktop))
- Git (opcional, para clonar el repositorio)

### Rocky Linux 8.9 (Producción)
- Docker Engine instalado
- Docker Compose instalado

```bash
# Instalar Docker en Rocky Linux
sudo dnf install -y docker docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
# Reiniciar sesión o ejecutar: newgrp docker
```

## Configuración Inicial

### 1. Clonar/Descargar el proyecto

```bash
cd /ruta/al/proyecto
```

### 2. Crear archivo de configuración

```bash
cp .env.example .env
```

Edita `.env` y ajusta las variables según tu entorno:

```env
ENVIRONMENT=local          # local para desarrollo, prod para producción
PORT=8000                 # Puerto del servidor
SECRET_KEY=tu-secret-key  # Cambiar en producción
AUTO_REGENERATE=true      # Auto-regeneración de reportes
CHECK_INTERVAL=300        # Intervalo de verificación (segundos)
```

**Importante**: En producción, genera una SECRET_KEY segura:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## Desarrollo Local (Mac)

### Opción 1: Usando scripts (Recomendado)

```bash
# Construir la imagen
./scripts/docker-build.sh

# Ejecutar el contenedor
./scripts/docker-run.sh
```

### Opción 2: Usando Docker Compose

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

### Opción 3: Comandos Docker directos

```bash
# Construir imagen
docker build -t ynk-modelo:latest .

# Ejecutar contenedor
docker run -d \
  --name ynk-modelo \
  -p 8000:8000 \
  -e ENVIRONMENT=local \
  -v $(pwd)/data:/app/data:ro \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/config:/app/config:ro \
  ynk-modelo:latest
```

### Acceder a la aplicación

Una vez iniciado, accede a:
- **Login**: http://localhost:8000/login
- **Reporte EERR**: http://localhost:8000/EERR_por_tienda.html
- **Simulador**: http://localhost:8000/Simulador_EERR.html

**Credenciales por defecto**:
- Usuario: `admin` / Contraseña: `ynk2025`
- Usuario: `viewer` / Contraseña: `viewer2025`

## Producción (Rocky Linux 8.9)

### 1. Preparar el servidor

```bash
# Instalar Docker (si no está instalado)
sudo dnf install -y docker docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker  # o reiniciar sesión
```

### 2. Desplegar la aplicación

```bash
# Copiar proyecto al servidor (usando scp, rsync, o git)
cd /opt/ynk-modelo  # o la ruta que prefieras

# Configurar entorno
cp .env.example .env
# Editar .env y configurar ENVIRONMENT=prod

# Construir y ejecutar
./scripts/docker-prod.sh
```

O manualmente:

```bash
# Construir imagen
docker build -t ynk-modelo:latest .

# Ejecutar con docker-compose (recomendado)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. Configurar como servicio systemd (Opcional)

Crear `/etc/systemd/system/ynk-modelo.service`:

```ini
[Unit]
Description=YNK Modelo Docker Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/ynk-modelo
ExecStart=/usr/bin/docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
User=ynk
Group=ynk

[Install]
WantedBy=multi-user.target
```

Activar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ynk-modelo
sudo systemctl start ynk-modelo
```

### 4. Configurar Nginx como proxy reverso (Recomendado)

Crear `/etc/nginx/conf.d/ynk-modelo.conf`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reiniciar Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Comandos Útiles

### Ver logs

```bash
# Docker Compose
docker-compose logs -f

# Docker directo
docker logs -f ynk-modelo

# Últimas 100 líneas
docker logs --tail 100 ynk-modelo
```

### Detener/Iniciar

```bash
# Docker Compose
docker-compose stop
docker-compose start
docker-compose restart

# Docker directo
docker stop ynk-modelo
docker start ynk-modelo
docker restart ynk-modelo
```

### Actualizar la aplicación

```bash
# 1. Detener contenedor
docker-compose down

# 2. Reconstruir imagen (si hay cambios en código)
./scripts/docker-build.sh

# 3. Iniciar nuevamente
docker-compose up -d
```

### Limpiar recursos Docker

```bash
# Eliminar contenedor
docker rm ynk-modelo

# Eliminar imagen
docker rmi ynk-modelo:latest

# Limpiar todo (cuidado: elimina imágenes no usadas)
docker system prune -a
```

## Estructura de Volúmenes

Los siguientes directorios se montan como volúmenes:

- `./data` → `/app/data` (solo lectura) - Archivos Excel de entrada
- `./output` → `/app/output` (lectura/escritura) - HTML generados
- `./logs` → `/app/logs` (lectura/escritura) - Logs de la aplicación
- `./config` → `/app/config` (solo lectura) - Configuración de usuarios

## Variables de Entorno

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `ENVIRONMENT` | Ambiente: `local` o `prod` | `local` |
| `PORT` | Puerto del servidor Flask | `8000` |
| `SECRET_KEY` | Clave secreta para Flask | `ynk-dev-secret-key...` |
| `AUTO_REGENERATE` | Auto-regeneración de reportes | `true` |
| `CHECK_INTERVAL` | Intervalo de verificación (seg) | `300` |
| `LOG_DIR` | Directorio de logs | `logs` |

## Troubleshooting

### El contenedor no inicia

```bash
# Ver logs de error
docker logs ynk-modelo

# Verificar que los puertos no estén en uso
netstat -tulpn | grep 8000
# o
lsof -i :8000
```

### Error de permisos en volúmenes

```bash
# Ajustar permisos en Mac
chmod -R 755 data output logs config

# En Linux, verificar que el usuario tenga acceso
ls -la data output logs
```

### El servidor no responde

```bash
# Verificar que el contenedor está corriendo
docker ps | grep ynk-modelo

# Verificar healthcheck
docker inspect ynk-modelo | grep -A 10 Health

# Probar conexión desde dentro del contenedor
docker exec ynk-modelo curl http://localhost:8000/api/status
```

### Reconstruir desde cero

```bash
# Detener y eliminar
docker-compose down
docker rmi ynk-modelo:latest

# Reconstruir
./scripts/docker-build.sh
./scripts/docker-run.sh
```

## Seguridad en Producción

1. **Cambiar SECRET_KEY**: Usa una clave segura generada aleatoriamente
2. **Usar HTTPS**: Configura SSL/TLS con Let's Encrypt
3. **Firewall**: Abre solo los puertos necesarios (80, 443)
4. **Actualizar contraseñas**: Cambia las contraseñas por defecto en `config/users.txt`
5. **Backups**: Realiza backups regulares de `data/` y `output/`
6. **Logs**: Monitorea los logs regularmente

## Soporte

Para problemas o preguntas, consulta:
- `README.md` - Documentación general
- `DEPLOYMENT.md` - Guía de deployment sin Docker
- `DEPLOYMENT_LINUX.md` - Deployment específico para Linux
