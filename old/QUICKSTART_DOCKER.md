# Inicio Rápido con Docker

## 🚀 Mac (Local)

### Paso 1: Configurar variables de entorno
```bash
cp env.example .env
# Opcional: editar .env si necesitas cambiar el puerto u otras configuraciones
```

### Paso 2: Construir la imagen Docker
```bash
./scripts/docker-build.sh
```

### Paso 3: Ejecutar el contenedor
```bash
./scripts/docker-run.sh
```

### Paso 4: Acceder a la aplicación
Abre tu navegador en: **http://localhost:8000/login**

**Credenciales:**
- Usuario: `admin` / Contraseña: `ynk2025`
- Usuario: `viewer` / Contraseña: `viewer2025`

---

## 🖥️ Rocky Linux 8.9 (Producción)

### Paso 1: Instalar Docker (si no está instalado)
```bash
sudo dnf install -y docker docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker  # o reiniciar sesión
```

### Paso 2: Configurar entorno
```bash
cp env.example .env
# Editar .env y cambiar:
# ENVIRONMENT=prod
# SECRET_KEY=<generar-una-clave-segura>
```

Generar SECRET_KEY segura:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Paso 3: Desplegar
```bash
./scripts/docker-prod.sh
```

### Paso 4: Acceder
El servidor estará disponible en: **http://localhost:8000/login**

---

## 📋 Comandos Útiles

### Ver logs
```bash
docker logs -f ynk-modelo
# o con docker-compose
docker-compose logs -f
```

### Detener
```bash
docker stop ynk-modelo
# o con docker-compose
docker-compose down
```

### Reiniciar
```bash
docker restart ynk-modelo
# o con docker-compose
docker-compose restart
```

### Actualizar (después de cambios en el código)
```bash
./scripts/docker-build.sh
docker-compose restart
```

---

## 📚 Documentación Completa

Para más detalles, ver [DOCKER.md](DOCKER.md)
