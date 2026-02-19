# Guía de Uso - Sistema de Autenticación Flask

## 🚀 Inicio Rápido

### Iniciar servidor CON autenticación:
```bash
ynk-server-auth
```

### Iniciar servidor SIN autenticación (modo anterior):
```bash
ynk-server
```

## 🔑 Credenciales de Prueba

| Usuario | Contraseña | Rol | Descripción |
|---------|-----------|-----|-------------|
| `admin` | `ynk2025` | Admin | Acceso completo |
| `viewer` | `viewer2025` | Viewer | Solo visualización |
| `pedrotorres` | `torres2025` | Admin | Usuario personalizado |

## 📋 Funcionalidades

### ✅ Servidor CON Autenticación (`ynk-server-auth`)
- ✅ Requiere login para acceder
- ✅ Sesiones persistentes (remember me)
- ✅ Auto-regeneración al detectar cambios en data/
- ✅ Protección de todas las rutas
- ✅ API endpoints protegidos
- ✅ Logout seguro

### 📄 Servidor SIN Autenticación (`ynk-server`)
- ✅ Acceso directo sin login (modo anterior)
- ✅ Auto-regeneración funcionando
- ✅ Ideal para desarrollo local

## 🌐 URLs Disponibles

### Con Autenticación (`ynk-server-auth`):
```
http://localhost:8000/login              - Página de login
http://localhost:8000/EERR_por_tienda.html  - Reporte EERR (requiere login)
http://localhost:8000/Simulador_EERR.html   - Simulador (requiere login)
http://localhost:8000/logout             - Cerrar sesión
http://localhost:8000/api/check          - API verificación (requiere login)
http://localhost:8000/api/status         - API estado (requiere login)
```

### Sin Autenticación (`ynk-server`):
```
http://SQLite - Reporte EERR (acceso directo)
http://localhost:8000/Simulador_EERR.html   - Simulador (acceso directo)
http://localhost:8000/api/check          - API verificación
http://localhost:8000/api/status         - API estado
```

## 👥 Gestión de Usuarios

### Opción 1: Editar código directamente
Edita el archivo `src/ynk_modelo/cli/flask_server.py`:

```python
USERS = {
    "nuevo_usuario": {"password": "contraseña_segura", "name": "Nombre Completo"},
    # ... más usuarios
}
```

### Opción 2: Usar archivo de configuración
Edita `config/users.txt`:

```
nuevo_usuario:contraseña_segura:Nombre Completo:admin
```

**Nota**: Actualmente los usuarios están hardcodeados. Para producción, se recomienda migrar a base de datos con contraseñas hasheadas (bcrypt).

## 🔒 Seguridad

### Variables de Entorno Importantes

Crea/edita `.env`:

```bash
# Secret key para sesiones (CAMBIAR en producción)
SECRET_KEY=tu-clave-secreta-muy-larga-y-aleatoria-aqui

# Ambiente
ENVIRONMENT=prod

# Puerto
PORT=8000
```

### Generar SECRET_KEY segura:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## 🚀 Despliegue a Producción

### Rocky Linux con systemd

1. **Detener servidor sin auth** (si está corriendo):
```bash
sudo systemctl stop ynk-modelo
```

2. **Editar servicio systemd**:
```bash
sudo nano /etc/systemd/system/ynk-modelo.service
```

Cambiar línea `ExecStart`:
```ini
# Antes (sin auth):
ExecStart=/usr/bin/ynk-server --host 0.0.0.0 --port 8000

# Después (con auth):
ExecStart=/usr/bin/ynk-server-auth --host 0.0.0.0 --port 8000
```

3. **Recargar y reiniciar**:
```bash
sudo systemctl daemon-reload
sudo systemctl start ynk-modelo
sudo systemctl status ynk-modelo
```

### Consideraciones de Seguridad para Producción

1. **HTTPS**: Usar Nginx como reverse proxy con SSL/TLS
2. **Contraseñas**: Hashear con bcrypt (no en texto plano)
3. **Secret Key**: Generar clave única y guardar en variable de entorno
4. **Base de Datos**: Migrar usuarios a SQLite/PostgreSQL
5. **Firewall**: Permitir solo puerto 8000 desde IPs autorizadas
6. **Logs**: Monitorear intentos de login fallidos

## 🧪 Pruebas

### Probar login desde terminal:
```bash
# Login correcto
curl -c cookies.txt -d "username=admin&password=ynk2025" http://localhost:8000/login

# Acceder con sesión
curl -b cookies.txt http://localhost:8000/api/status

# Logout
curl -b cookies.txt http://localhost:8000/logout
```

## 🔄 Auto-Regeneración

Funciona igual en ambos modos:

1. Modifica cualquier archivo Excel en `data/`
2. Recarga la página en el navegador
3. El sistema detecta cambios y regenera automáticamente

## ❓ Troubleshooting

### El login no funciona
- Verifica credenciales en el código o `config/users.txt`
- Revisa logs: `tail -f logs/ynk_modelo_*.log`
- Limpia cookies del navegador

### Redirección infinita
- Limpia caché del navegador (Cmd+Shift+R)
- Cierra sesión: http://localhost:8000/logout
- Borra cookies manualmente

### Puerto ocupado
```bash
# Matar proceso en puerto 8000
lsof -ti:8000 | xargs kill -9
```

## 📚 Migración Futura

Para mejorar la seguridad, considera:

1. **Flask-Security-Too**: Autenticación completa con roles
2. **SQLAlchemy**: Base de datos para usuarios
3. **Bcrypt**: Hash de contraseñas
4. **OAuth2**: Integración con Google/Microsoft
5. **LDAP**: Integración con Active Directory corporativo

## 📞 Soporte

Para dudas o problemas:
1. Revisa los logs en `logs/`
2. Verifica variables de entorno en `.env`
3. Comprueba que Flask y Flask-Login están instalados
4. Consulta documentación de Flask-Login: https://flask-login.readthedocs.io/
