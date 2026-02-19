# YNK Modelo EBITDA - Guía de Uso

## 📋 Configuración de Ambiente

### Variables de Entorno

Edita el archivo `.env` para configurar el ambiente:

```bash
# Ambiente: local o prod
ENVIRONMENT=local

# Directorio de logs
LOG_DIR=logs

# Intervalo de verificación en producción (segundos)
CHECK_INTERVAL=300

# Habilitar auto-regeneración en PROD
AUTO_REGENERATE=true
```

---

## 🚀 Uso

### Modo LOCAL (desarrollo)

```bash
# Opción 1: Generar reportes manualmente
ynk-eerr --sin-selector

# Opción 2: Servidor web (sin auto-verificación)
./scripts/run_local.sh
# Luego abre: http://localhost:8000
```

### Modo PRODUCCIÓN (auto-verificación al visitar)

```bash
# Opción 1: Script recomendado
./scripts/run_prod.sh

# Opción 2: Comando directo
ENVIRONMENT=prod ynk-server

# Opción 3: Editar .env primero
# (Cambiar ENVIRONMENT=prod en .env)
ynk-server
```

**Luego abre en tu navegador:**
- http://localhost:8000/EERR_por_tienda.html
- http://localhost:8000/Simulador_EERR.html

---

## 📊 Auto-regeneración en PROD

Cuando ejecutas el servidor en modo **PROD**, el sistema:

1. ✅ **Verifica cambios** cada vez que visitas una página HTML
2. ✅ **Detecta cambios** por fecha de modificación de archivos
3. ✅ **Regenera automáticamente** si hay cambios nuevos
4. ✅ **Sirve la versión actualizada** inmediatamente
5. ✅ **Registra en logs** cada operación con fecha/hora

**No más esperas de 5 minutos** - Los cambios se detectan **inmediatamente al cargar la página**

### Ejemplo de log:

```
2025-12-17 14:30:15 | INFO     | 127.0.0.1 - GET /Simulador_EERR.html
2025-12-17 14:30:15 | INFO     | ======================================================================
2025-12-17 14:30:15 | INFO     | ¡CAMBIOS DETECTADOS! Regenerando reportes...
2025-12-17 14:30:15 | INFO     | ----------------------------------------------------------------------
2025-12-17 14:30:15 | INFO     |   • D1_Venta y Contribucion.xlsx (modificado 2025-12-17 14:28:10)
2025-12-17 14:30:15 | INFO     | ----------------------------------------------------------------------
2025-12-17 14:30:22 | INFO     | ✓ REPORTES REGENERADOS EXITOSAMENTE
2025-12-17 14:30:22 | INFO     |   Tiempo: 7.23s
2025-12-17 14:30:22 | INFO     |   Fecha/Hora: 2025-12-17 14:30:22
2025-12-17 14:30:22 | INFO     | ======================================================================
```

---

## 📁 Estructura de Archivos

```
YNK_Store Planner/
├── .env                    # Configuración de ambiente
├── .env.example            # Template de configuración
├── data/                   # Archivos Excel de entrada
├── output/                 # HTML generados
│   ├── EERR_por_tienda.html
│   └── Simulador_EERR.html
├── logs/                   # Logs del sistema
│   └── ynk_modelo_YYYYMMDD.log
├── scripts/
│   └── run_prod.sh        # Script para ejecutar en PROD
└── src/ynk_modelo/
    ├── cli/
    │   ├── main.py         # Generador de reportes
    │   └── auto_regenerate.py  # Auto-regenerador
    └── utils/
        ├── logger.py       # Sistema de logging
        └── file_watcher.py # Detector de cambios
```

---

## 🔧 Instalación

```bash
# Instalar dependencias
pip install -e .[dev]

# O manualmente
pip install pandas openpyxl python-dotenv
```

---

## 📝 Logs

Los logs se guardan en `logs/ynk_modelo_YYYYMMDD.log` con formato:

```
YYYY-MM-DD HH:MM:SS | NIVEL | Mensaje
```

### Niveles de log:
- **INFO**: Operaciones normales
- **WARNING**: Advertencias (archivos faltantes, etc.)
- **ERROR**: Errores en procesamiento
- **DEBUG**: Información detallada (solo en desarrollo)

---puerto del servidor

```bash
ynk-server --port 3000
```

### Cambiar host del servidor

```bash
ynk-server --host 127.0.0.1 --port 8080
```

### Endpoints API disponibles

- `GET /api/check` - Verifica cambios y regenera si es necesario
- `GET /api/status` - Estado del sistema y archivos monitoreados

### Ejemplo de uso de API

```bash
# Verificar y regenerar manualmente
curl http://localhost:8000/api/check

# Ver estado del sistema
curl http://localhost:8000/api/status
```

### Ver solo errores en consola

El sistema siempre guarda logs completos en archivos, pero puedes filtrar la salida de consola modificando `src/ynk_modelo/utils/logger.py`.

---

## 🐛 Troubleshooting

### No detecta cambios

1. Verifica que los archivos estén en `data/`
2. Revisa que tengan extensión `.xlsx` o `.xls`
3. Verifica permisos de lectura

### Logs no se crean

1. Verifica que el directorio `logs/` sea escribible
2. Revisa la variable `LOG_DIR` en `.env`

### Error de importación

```bash
# Reinstalar el paquete
pip install -e .
```

---

## 📞 Soporte

Para más información, revisa el código en:
- `src/ynk_modelo/cli/auto_regenerate.py` - Auto-regeneración
- `src/ynk_modelo/utils/file_watcher.py` - Detección de cambios
- `src/ynk_modelo/utils/logger.py` - Sistema de logging
