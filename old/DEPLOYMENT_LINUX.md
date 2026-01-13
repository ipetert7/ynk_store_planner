# 🐧 Deploy a Rocky Linux (Producción)

## Arquitectura

- **Local (Mac)**: Desarrollo y edición de archivos Excel
- **Servidor (Rocky Linux)**: Producción con auto-regeneración

---

## 📦 Primera Instalación en Rocky Linux

### 1️⃣ Preparar servidor (una sola vez)

**En tu Mac**, edita el archivo `deploy/deploy.sh` y configura:

```bash
REMOTE_USER="tu_usuario"           # Usuario SSH del servidor
REMOTE_HOST="192.168.1.100"        # IP o hostname del servidor
REMOTE_PATH="/opt/ynk-modelo"      # Ruta donde instalar
```

### 2️⃣ Ejecutar deploy desde tu Mac

```bash
./deploy/deploy.sh
```

Esto hará:
- ✅ Transferir todo el código al servidor
- ✅ Transferir archivos Excel de `data/`
- ✅ Instalar dependencias (Python 3, pip, etc.)
- ✅ Crear entorno virtual
- ✅ Configurar servicio systemd
- ✅ Abrir puerto en firewall
- ✅ Configurar permisos

### 3️⃣ Verificar instalación

**Conectarse al servidor:**
```bash
ssh usuario@servidor
```

**Iniciar servicio:**
```bash
sudo systemctl start ynk-modelo
sudo systemctl status ynk-modelo
```

Deberías ver:
```
● ynk-modelo.service - YNK Modelo EBITDA Server
   Loaded: loaded
   Active: active (running)
```

### 4️⃣ Acceder a las páginas

Abre en tu navegador:
```
http://IP_SERVIDOR:8000/EERR_por_tienda.html
http://IP_SERVIDOR:8000/Simulador_EERR.html
```

---

## 🔄 Actualizar Datos (día a día)

### Opción 1: Sync automático (recomendado)

**Desde tu Mac:**
```bash
./deploy/sync_data.sh
```

Esto:
- Sube los archivos Excel nuevos/modificados
- La próxima vez que visites la página web, detectará los cambios
- Regenerará automáticamente

### Opción 2: Manual

1. **Subir archivos con SFTP/SCP:**
```bash
scp data/*.xlsx usuario@servidor:/opt/ynk-modelo/data/
```

2. **Los reportes se regenerarán automáticamente** al visitar las páginas

---

## 🛠️ Gestión del Servicio en Rocky Linux

### Comandos systemd

```bash
# Iniciar servicio
sudo systemctl start ynk-modelo

# Detener servicio
sudo systemctl stop ynk-modelo

# Reiniciar servicio
sudo systemctl restart ynk-modelo

# Ver estado
sudo systemctl status ynk-modelo

# Habilitar auto-inicio
sudo systemctl enable ynk-modelo

# Deshabilitar auto-inicio
sudo systemctl disable ynk-modelo
```

### Ver logs

```bash
# Logs del sistema (systemd)
sudo journalctl -u ynk-modelo -f

# Logs de la aplicación
tail -f /opt/ynk-modelo/logs/server.log
tail -f /opt/ynk-modelo/logs/ynk_modelo_$(date +%Y%m%d).log
```

---

## 🔒 Configuración de Firewall

### Abrir puerto (si no se hizo en instalación)

```bash
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

### Verificar puertos abiertos

```bash
sudo firewall-cmd --list-ports
```

---

## 🌐 Acceso desde otras computadoras

### Opción 1: Por IP directa

```
http://192.168.1.100:8000
```

### Opción 2: Configurar DNS/hosts

En otras computadoras, editar `/etc/hosts` (Linux/Mac) o `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
192.168.1.100    ynk-modelo.local
```

Luego acceder:
```
http://ynk-modelo.local:8000
```

### Opción 3: Nginx como reverse proxy

Instalar Nginx:
```bash
sudo dnf install nginx
```

Configurar `/etc/nginx/conf.d/ynk-modelo.conf`:
```nginx
server {
    listen 80;
    server_name ynk-modelo.local;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Iniciar Nginx:
```bash
sudo systemctl enable nginx
sudo systemctl start nginx
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

Acceder:
```
http://ynk-modelo.local/EERR_por_tienda.html
```

---

## 🔧 Actualizar Código (cuando modificas Python)

**Desde tu Mac:**

```bash
# 1. Transferir código actualizado
./deploy/deploy.sh

# 2. Reiniciar servicio (SSH al servidor)
ssh usuario@servidor "sudo systemctl restart ynk-modelo"
```

---

## 📊 Monitoreo

### Ver uso de recursos

```bash
# CPU y memoria
htop

# Procesos Python
ps aux | grep python

# Conexiones al puerto
sudo netstat -tulpn | grep 8000
```

### Alertas automáticas

Configurar systemd para reiniciar automáticamente:

Editar `/etc/systemd/system/ynk-modelo.service`:
```ini
[Service]
Restart=always
RestartSec=10
```

Recargar:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ynk-modelo
```

---

## 🐛 Troubleshooting

### El servicio no inicia

```bash
# Ver logs detallados
sudo journalctl -u ynk-modelo -n 50 --no-pager

# Verificar permisos
ls -la /opt/ynk-modelo

# Verificar que el entorno virtual existe
ls -la /opt/ynk-modelo/.venv

# Probar manualmente
cd /opt/ynk-modelo
source .venv/bin/activate
python3 -m ynk_modelo.cli.server
```

### Puerto ocupado

```bash
# Ver qué está usando el puerto
sudo lsof -i :8000

# Matar proceso si es necesario
sudo kill -9 PID
```

### Permisos denegados

```bash
# Cambiar dueño de archivos
sudo chown -R usuario:usuario /opt/ynk-modelo

# Permisos de logs
sudo chmod 755 /opt/ynk-modelo/logs
```

### No se conecta desde otra computadora

```bash
# Verificar que escucha en 0.0.0.0
sudo netstat -tulpn | grep 8000

# Verificar firewall
sudo firewall-cmd --list-all

# Desactivar SELinux temporalmente (para testing)
sudo setenforce 0
```

---

## 📁 Estructura en Servidor

```
/opt/ynk-modelo/
├── .env                    # Configuración (ENVIRONMENT=prod)
├── .venv/                  # Entorno virtual Python
├── data/                   # Archivos Excel de entrada
│   ├── D0_Diccionario tiendas.xlsx
│   ├── D1_Venta y Contribucion.xlsx
│   └── ...
├── output/                 # HTML generados
│   ├── EERR_por_tienda.html
│   └── Simulador_EERR.html
├── logs/                   # Logs de aplicación
│   ├── server.log
│   ├── server_error.log
│   └── ynk_modelo_YYYYMMDD.log
├── src/                    # Código fuente
├── static/                 # CSS, imágenes
├── templates/              # Templates HTML
├── scripts/                # Scripts de gestión
└── deploy/                 # Scripts de deploy
```

---

## ✅ Checklist de Producción

- [ ] Servidor Rocky Linux configurado
- [ ] Usuario con permisos sudo
- [ ] SSH configurado desde tu Mac
- [ ] `deploy/deploy.sh` editado con IP/usuario correcto
- [ ] Deploy ejecutado exitosamente
- [ ] Servicio systemd iniciado
- [ ] Firewall configurado (puerto 8000 abierto)
- [ ] Páginas accesibles desde navegador
- [ ] Auto-regeneración funcionando (probado modificando Excel)
- [ ] Logs monitoreados

---

## 🔄 Flujo de Trabajo Diario

1. **En tu Mac**: Editas archivos Excel en `data/`
2. **Sincronizas**: `./deploy/sync_data.sh`
3. **En navegador**: Refrescas la página
4. **Sistema**: Detecta cambios y regenera automáticamente
5. **Ves**: Datos actualizados instantáneamente

---

**¡Tu sistema está listo para producción en Rocky Linux!** 🚀
