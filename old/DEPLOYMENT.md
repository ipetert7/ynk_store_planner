# 🚀 Guía de Despliegue a Producción

## Pasos para pasar a PROD

### 1️⃣ Editar configuración

Abre el archivo `.env` y cambia:

```bash
ENVIRONMENT=prod
```

Eso es todo. El resto de la configuración ya está lista.

### 2️⃣ Iniciar el servidor

```bash
./scripts/daemon_start.sh
```

El servidor quedará corriendo en background y se auto-verificará cada vez que visites las páginas.

### 3️⃣ Verificar que está corriendo

```bash
./scripts/status.sh
```

Deberías ver:
```
✓ Servidor está CORRIENDO
PID: 12345
Ambiente: prod
Puerto: 8000
URL: http://localhost:8000
```

### 4️⃣ Acceder a las páginas

Abre en tu navegador:
- http://localhost:8000/EERR_por_tienda.html
- http://localhost:8000/Simulador_EERR.html

**¡Listo!** Cada vez que refresques la página, verificará si hay cambios en `data/` y regenerará automáticamente.

---

## 📋 Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `./scripts/daemon_start.sh` | Iniciar servidor en background |
| `./scripts/stop.sh` | Detener servidor |
| `./scripts/restart.sh` | Reiniciar servidor |
| `./scripts/status.sh` | Ver estado del servidor |
| `tail -f logs/server.log` | Ver logs en tiempo real |

---

## 🔄 Reiniciar después de cambios en código

Si modificas el código Python (no los datos Excel), necesitas reiniciar:

```bash
./scripts/restart.sh
```

---

## 🌐 Acceder desde otra computadora (opcional)

Si quieres acceder desde otra computadora en la misma red:

1. Encuentra tu IP:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

2. Edita `.env` y agrega:
```bash
HOST=0.0.0.0
```

3. Reinicia el servidor:
```bash
./scripts/restart.sh
```

4. Accede desde otra PC:
```
http://TU_IP:8000/EERR_por_tienda.html
```

---

## 🔐 Ejecutar al inicio del sistema (macOS)

Para que se inicie automáticamente cuando prendes la Mac:

1. Crea el archivo `~/Library/LaunchAgents/com.ynk.modelo.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ynk.modelo</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/TU_USUARIO/Downloads/YNK_Store Planner/scripts/daemon_start.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/Users/TU_USUARIO/Downloads/YNK_Store Planner/logs/launchd.err</string>
    <key>StandardOutPath</key>
    <string>/Users/TU_USUARIO/Downloads/YNK_Store Planner/logs/launchd.out</string>
</dict>
</plist>
```

**Reemplaza `TU_USUARIO` con tu nombre de usuario.**

2. Carga el servicio:
```bash
launchctl load ~/Library/LaunchAgents/com.ynk.modelo.plist
```

3. Para detener el auto-inicio:
```bash
launchctl unload ~/Library/LaunchAgents/com.ynk.modelo.plist
```

---

## 🐛 Solución de problemas

### El servidor no inicia

1. Verifica que las dependencias estén instaladas:
```bash
pip install -e .
```

2. Revisa los logs:
```bash
cat logs/server.log
```

### No detecta cambios

1. Verifica que estés en modo PROD:
```bash
grep ENVIRONMENT .env
```

2. Verifica que los archivos estén en `data/` con extensión `.xlsx` o `.xls`

3. Revisa los logs para ver si hay errores:
```bash
tail -f logs/ynk_modelo_$(date +%Y%m%d).log
```

### El puerto 8000 está ocupado

Cambia el puerto en `.env`:
```bash
PORT=3000
```

Y reinicia:
```bash
./scripts/restart.sh
```

---

## 📊 Monitoreo

Ver logs en tiempo real:
```bash
# Logs del servidor
tail -f logs/server.log

# Logs de la aplicación
tail -f logs/ynk_modelo_$(date +%Y%m%d).log
```

---

## ✅ Checklist de Producción

- [ ] `.env` configurado con `ENVIRONMENT=prod`
- [ ] Dependencias instaladas (`pip install -e .`)
- [ ] Servidor iniciado (`./scripts/daemon_start.sh`)
- [ ] Estado verificado (`./scripts/status.sh`)
- [ ] Páginas accesibles en http://localhost:8000
- [ ] Logs funcionando correctamente
- [ ] Auto-verificación activada (logs muestran detección de cambios)

---

**¡Tu sistema está listo para producción!** 🎉
