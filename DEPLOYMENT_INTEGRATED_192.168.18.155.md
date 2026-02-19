# Despliegue integrado Docker (Flask + Next.js + Nginx)

Este despliegue publica:

- `http://192.168.18.155/` -> `ynk-main` (Flask)
- `http://192.168.18.155/arriendos` -> `ynk-arriendos` (Next.js)

## 1) Prerrequisitos del servidor

- Docker Engine instalado
- Docker Compose plugin (`docker compose`) disponible
- Puerto `TCP/80` abierto en firewall interno hacia `192.168.18.155`

## 2) Preparar entorno y secretos

En la raíz del repositorio:

```bash
cp .env.integrated.example .env
```

Editar `.env` y reemplazar al menos:

- `SECRET_KEY`
- `SSO_SECRET`
- `SSO_SYNC_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL=http://192.168.18.155/arriendos`

Importante:
- `SSO_SECRET` y `SSO_SYNC_SECRET` deben coincidir en ambos módulos.
- No usar secretos de ejemplo en producción.

## 3) Levantar stack completo

```bash
bash infra/scripts/deploy-integrated.sh
```

El script:
- crea carpetas persistentes necesarias
- compila imágenes
- levanta contenedores en segundo plano
- muestra `docker compose ps`

## 4) Verificación de operación

Desde el servidor o cualquier host con acceso a la red:

```bash
bash infra/scripts/verify-integrated.sh 192.168.18.155
```

También puedes inspeccionar logs:

```bash
docker compose -f docker-compose.integrated.yml logs -f nginx ynk-main ynk-arriendos
```

## 5) Criterios de aceptación

1. `GET /` responde `200` o `302`.
2. `GET /arriendos` responde `200` o `302`.
3. El login SSO no entra en loop.
4. Reinicio de host: los servicios vuelven automáticamente (`restart: unless-stopped`).
5. Datos persistentes (SQLite/backups/logs) se conservan entre reinicios.

## 6) Troubleshooting rápido

- Si `server not found`:
  - validar firewall/ruta de red a `192.168.18.155:80`
  - validar que `nginx` esté `Up` en `docker compose ps`
- Si `/arriendos` carga pero autenticación falla:
  - validar `NEXTAUTH_URL` exacto (`http://192.168.18.155/arriendos`)
  - validar que `SSO_SECRET` y `SSO_SYNC_SECRET` coincidan entre servicios
