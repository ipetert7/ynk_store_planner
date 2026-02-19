import { Prisma, PrismaClient } from '@prisma/client'

export const RESTORE_IN_PROGRESS = 'RESTORE_IN_PROGRESS'

export class RestoreInProgressError extends Error {
  code: string

  constructor() {
    super('Restauración en progreso. Intente nuevamente en unos segundos.')
    this.name = 'RestoreInProgressError'
    this.code = RESTORE_IN_PROGRESS
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaMiddlewareRegistered: boolean | undefined
  restoreMaintenanceMode: boolean | undefined
}

const BLOCKED_ACTIONS_DURING_RESTORE = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
])

/**
 * Prisma Client singleton instance
 * Prevents multiple instances in development with hot reload
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: 'pretty',
})

if (!globalForPrisma.prismaMiddlewareRegistered) {
  prisma.$use(async (params: Prisma.MiddlewareParams, next) => {
    if (isRestoreMaintenanceModeEnabled() && BLOCKED_ACTIONS_DURING_RESTORE.has(params.action)) {
      throw new RestoreInProgressError()
    }

    return next(params)
  })

  globalForPrisma.prismaMiddlewareRegistered = true
}

if (globalForPrisma.restoreMaintenanceMode === undefined) {
  globalForPrisma.restoreMaintenanceMode = false
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export function enableRestoreMaintenanceMode(): void {
  globalForPrisma.restoreMaintenanceMode = true
}

export function disableRestoreMaintenanceMode(): void {
  globalForPrisma.restoreMaintenanceMode = false
}

export function isRestoreMaintenanceModeEnabled(): boolean {
  return globalForPrisma.restoreMaintenanceMode === true
}

/**
 * Health check para verificar la conexión a la base de datos
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection error:', error)
    return false
  }
}

/**
 * Cierra la conexión de Prisma de forma segura
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error disconnecting Prisma:', error)
  }
}

// Manejo de errores de conexión
prisma.$on('error' as never, (e: Error) => {
  console.error('Prisma Client error:', e)
})

// Cleanup on process termination
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await disconnectPrisma()
  })
}
