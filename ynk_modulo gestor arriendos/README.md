# Gestor de Arriendos - YNK

Sistema web para administrar contratos de arriendo de tiendas, con KPI, alertas de vencimiento, auditoría y seguimiento de UF.

## Funcionalidades clave

- Dashboard con KPI (tiendas activas/terminadas, VMM total, m2, UF diaria).
- Gestión de tiendas y contratos: crear, editar, cerrar (soft delete).
- Modificaciones permanentes y temporales con validaciones y periodos no superpuestos.
- Alertas de vencimiento y fechas de notificación configurables.
- Búsqueda, filtros avanzados y ordenamiento en listados.
- Historial de auditoría por tienda (últimos 100 eventos).
- Valor diario de UF con historial y precarga.
- Perfil de usuario con cambio de nombre, contraseña y foto.
- Backups automáticos y manuales de la base de datos con restauración segura.

## Stack

- Next.js 14 (App Router) + React 18.
- NextAuth (Credentials, JWT).
- Prisma + SQLite.
- Tailwind CSS + Recharts.
- Zod para validaciones de formularios.

## Requisitos previos

- Node.js 18+
- npm

## Configuración rápida

Si solo necesitas los pasos rápidos, revisa `SETUP.md`.

1. Instalar dependencias:
```bash
npm install
```

2. Crear `.env` en la raíz del proyecto:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-clave-secreta
DATABASE_URL="file:./prisma/dev.db"
```

3. Ejecutar migraciones y generar cliente Prisma:
```bash
npm run db:migrate
npm run db:generate
```

4. Crear usuario inicial:
```bash
npm run create-user
```

Credenciales por defecto:
- Email: `admin@ynk.cl`
- Contraseña: `admin123`

5. Iniciar el servidor:
```bash
npm run dev
```

Abrir `http://localhost:3000` y acceder con el usuario creado.

## Variables de entorno

| Variable | Requerida | Descripción | Ejemplo |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sí | URL de SQLite usada por Prisma | `file:./prisma/dev.db` |
| `NEXTAUTH_SECRET` | Sí | Secreto para NextAuth | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Sí (prod) | URL base de la app | `https://app.ynk.cl` |
| `CRON_SECRET` | No | Protege los endpoints de cron | `mi-secreto` |
| `BACKUP_DIR` | No | Directorio de backups (relativo o absoluto) | `backups` |
| `BACKUP_ENABLED` | No | Activa/desactiva el backup automático | `true` |
| `SYSTEM_USER_EMAIL` | No | Usuario del sistema para cron | `system@ynk.local` |
| `SYSTEM_USER_NAME` | No | Nombre del usuario del sistema | `Sistema` |
| `SSO_SECRET` | Sí (integración) | Secreto para validar JWT SSO desde Flask | `igual a SSO_SECRET en Flask` |
| `SSO_SYNC_SECRET` | Sí (integración) | Secreto para sincronización de usuarios | `igual a SSO_SYNC_SECRET en Flask` |
| `SSO_SYNC_URL` | Sí (integración) | URL del endpoint Flask `/api/sso/users` | `http://ynk-main:8000/api/sso/users` |

Notas:
- `DATABASE_URL="file:./prisma/dev.db"` evita rutas ambiguas y mantiene la DB en `prisma/dev.db`.
- En desarrollo, los endpoints de cron se permiten sin `CRON_SECRET`.
- `BACKUP_DIR` por defecto es `backups/` en la raíz del proyecto.
- En Docker integrado se recomienda `BACKUP_DIR=/app/backups` con bind mount para persistencia.

## Base de datos

Modelos principales:
- **User**: usuarios del sistema.
- **Store**: tiendas y contratos.
- **TemporaryModification**: cambios temporales financieros.
- **AuditLog**: eventos de auditoría.
- **UFValue**: valores diarios de UF.

Comandos útiles:
- `npm run db:migrate` - Ejecutar migraciones
- `npm run db:generate` - Generar cliente Prisma
- `npm run db:studio` - Abrir Prisma Studio
- `npm run db:reset` - **BORRAR y recrear** base de datos de desarrollo

## Cron jobs y UF

Configurados en `vercel.json`:
- `/api/cron/uf` (01:00) actualiza UF del día y precarga históricos.
- `/api/cron/revert-modifications` (02:00) elimina modificaciones temporales expiradas y audita el cambio.
- `/api/cron/backup` (03:00) crea un backup de la base de datos.

Los cron requieren `Authorization: Bearer <CRON_SECRET>` en producción.
Los valores de UF se obtienen desde la API pública de `mindicador.cl`.
El cron de backup se omite si `BACKUP_ENABLED=false`.

## Backups

- Los backups se almacenan en `backups/` (configurable con `BACKUP_DIR`).
- `metadata.json` guarda el historial y checksum de cada backup.
- Los backups incluyen información sobre la cantidad de tiendas almacenadas.
- Restaurar un backup crea un respaldo preventivo antes de reemplazar la DB actual.
- Si hay un backup o restore activo, la API puede responder `503` temporalmente (`BACKUP_OPERATION_IN_PROGRESS` o `RESTORE_IN_PROGRESS`).

### Importante para restauración
La restauración desde UI funciona en caliente y bloquea temporalmente escrituras para evitar inconsistencias.

### Comandos de backup:
- `npm run backup` - Crear backup manual
- `npm run backup:list` - Listar backups disponibles
- `npm run backup:restore <backup-id>` - Restaurar backup

### Scripts avanzados:
- `npm run tsx scripts/restore-backup.ts` - Restauración interactiva con verificación de seguridad
- `npm run tsx scripts/diagnose-backup.ts` - Diagnosticar problemas con backups
- `npm run tsx scripts/update-backup-metadata.ts` - Actualizar metadatos de backups existentes

## Scripts disponibles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm run start` - Servidor de producción
- `npm run lint` - Lint del proyecto
- `npm run db:migrate` - Migraciones
- `npm run db:generate` - Cliente Prisma
- `npm run db:studio` - Prisma Studio
- `npm run db:reset` - **Borrar y recrear** base de datos de desarrollo
- `npm run db:seed` - Seed inicial (misma lógica que `create-user`)
- `npm run create-user` - Crear usuario inicial
- `npm run backup` - Crear backup manual
- `npm run backup:list` - Listar backups disponibles
- `npm run backup:restore <backup-id>` - Restaurar backup

## Estructura del proyecto

```
/
├── backups/              # Backups locales (no versionar)
├── prisma/
│   ├── schema.prisma      # Esquema de base de datos
│   ├── migrations/        # Migraciones
│   └── seed.ts            # Seed de usuario inicial
├── scripts/              # Scripts de mantenimiento (backup, restore)
├── src/
│   ├── app/               # Rutas Next.js (App Router)
│   │   ├── (auth)/        # Login
│   │   ├── (dashboard)/   # Dashboard y páginas principales
│   │   └── api/           # Endpoints
│   ├── components/
│   │   ├── ui/             # Componentes base
│   │   └── features/       # Componentes por feature
│   ├── hooks/             # Hooks de datos
│   ├── lib/               # API clients, utils, auth, prisma
│   └── types/             # Tipos TypeScript
└── package.json
```

## Seguridad y acceso

- Contraseñas hasheadas con bcrypt.
- Rutas protegidas por NextAuth middleware.
- Auditoría automática en operaciones críticas.
- Upload de fotos guardado en `public/images/profiles`.

## SSO con Portal principal

- El módulo se ejecuta bajo `/arriendos` y consume la sesión desde `ynk_main`.
- El login se realiza en Flask; la cookie `ynk_sso` se valida aquí.
- El endpoint `/api/sso/consume` crea la sesión interna de NextAuth.

## Licencia

Propietario - YNK
