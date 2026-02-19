# Guía de Configuración Rápida

## Pasos para iniciar el proyecto

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**
   
   Crea un archivo `.env` en la raíz del proyecto:
   ```env
   NEXTAUTH_URL=http://localhost/arriendos
   NEXTAUTH_SECRET=tu-clave-secreta-aqui
DATABASE_URL="file:./prisma/dev.db"
SSO_SECRET=igual-al-SSO_SECRET-de-Flask
SSO_SYNC_SECRET=igual-al-SSO_SYNC_SECRET-de-Flask
SSO_SYNC_URL=http://localhost/api/sso/users
   ```
   
   Para generar `NEXTAUTH_SECRET`, ejecuta:
   ```bash
   openssl rand -base64 32
   ```

3. **Configurar la base de datos**
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

4. **Crear usuario inicial**
   ```bash
   npm run create-user
   ```
   
   Credenciales por defecto:
   - Email: `admin@ynk.cl`
   - Contraseña: `admin123`

5. **Iniciar el servidor**
   ```bash
   npm run dev
   ```

6. **Abrir en el navegador**
   ```
   http://localhost/arriendos
   ```

7. **Iniciar sesión** desde el portal principal (`/login`) y volver a `/arriendos`.

## Configuración opcional (cron y backups)

Para proteger los endpoints de cron en producción:
```env
CRON_SECRET=tu-secreto
SYSTEM_USER_EMAIL=system@ynk.local
SYSTEM_USER_NAME=Sistema
BACKUP_DIR=backups
BACKUP_ENABLED=true
```

Los cron jobs están configurados en `vercel.json` y se ejecutan a diario.
Si `BACKUP_ENABLED=false`, el cron de backups se omite.
En Docker integrado usa `BACKUP_DIR=/app/backups` y un bind mount del directorio `backups/`.

## Comandos útiles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Construir para producción
- `npm run start` - Servidor de producción
- `npm run lint` - Lint del proyecto
- `npm run db:migrate` - Migraciones
- `npm run db:generate` - Cliente Prisma
- `npm run db:studio` - Prisma Studio
- `npm run db:seed` - Seed inicial (misma lógica que `create-user`)
- `npm run create-user` - Crear usuario inicial
- `npm run backup` - Crear backup manual
- `npm run backup:list` - Listar backups disponibles
- `npm run backup:restore <backup-id>` - Restaurar backup

## Comandos de Base de Datos

- `npm run db:migrate` - Ejecutar migraciones pendientes
- `npm run db:generate` - Generar cliente Prisma
- `npm run db:studio` - Abrir Prisma Studio (interfaz gráfica)
- `npm run db:reset` - **Borrar completamente** y recrear la base de datos de desarrollo

⚠️ **Importante**: `npm run db:reset` borra todos los datos existentes y recrea la base de datos desde cero. Úsalo solo cuando necesites empezar desde cero.

## Notas

- La base de datos SQLite se crea en `prisma/dev.db` usando `DATABASE_URL="file:./prisma/dev.db"`.
- El sistema de auditoría registra automáticamente creación, actualización y cierres.
- Las fotos de perfil se guardan en `public/images/profiles`.
- Los backups locales se guardan en `backups/` (configurable con `BACKUP_DIR`).
- Durante restauración, mutaciones concurrentes pueden responder `503` temporal con códigos `BACKUP_OPERATION_IN_PROGRESS` o `RESTORE_IN_PROGRESS`.
