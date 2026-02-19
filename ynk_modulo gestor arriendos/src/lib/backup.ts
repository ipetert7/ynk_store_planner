import { promises as fs } from 'fs'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import { join, dirname, isAbsolute } from 'path'
import { createHash } from 'crypto'
import { createGzip, createGunzip } from 'zlib'
import {
  prisma,
  enableRestoreMaintenanceMode,
  disableRestoreMaintenanceMode,
} from './prisma'

export const BACKUP_OPERATION_IN_PROGRESS = 'BACKUP_OPERATION_IN_PROGRESS'

export interface BackupMetadata {
  id: string
  filename: string
  path: string
  createdAt: string
  size: number
  compressedSize: number
  checksum: string
  status: 'success' | 'error'
  storeCount?: number
  error?: string
}

export interface BackupList {
  backups: BackupMetadata[]
  totalSize: number
  lastBackup?: string
}

type BackupOperationType = 'backup' | 'restore'

interface BackupMetadataDiskEntry {
  id?: unknown
  filename?: unknown
  path?: unknown
  createdAt?: unknown
  size?: unknown
  compressedSize?: unknown
  checksum?: unknown
  status?: unknown
  storeCount?: unknown
  error?: unknown
}

interface DiscoveredBackupFile {
  filename: string
  path: string
  compressedSize: number
  createdAt: string
}

export class BackupOperationInProgressError extends Error {
  code: string
  operation: BackupOperationType

  constructor(operation: BackupOperationType) {
    super(`Operación en progreso: ${operation}`)
    this.name = 'BackupOperationInProgressError'
    this.code = BACKUP_OPERATION_IN_PROGRESS
    this.operation = operation
  }
}

const BACKUP_DIR = process.env.BACKUP_DIR || 'backups'
const BACKUP_METADATA_FILE = 'metadata.json'
const BACKUP_FILE_PATTERN = /^backup-.*\.db\.gz$/

let currentBackupOperation: BackupOperationType | null = null
let legacyBackupDirectoryMigrationAttempted = false

/**
 * Obtener la ruta del directorio de backups
 */
export function getBackupDirectory(): string {
  if (isAbsolute(BACKUP_DIR)) {
    return BACKUP_DIR
  }
  return join(process.cwd(), BACKUP_DIR)
}

function getLegacyMisresolvedBackupDirectory(): string | null {
  if (!isAbsolute(BACKUP_DIR)) {
    return null
  }

  const legacyPath = join(process.cwd(), BACKUP_DIR)
  const normalizedCurrent = BACKUP_DIR.replace(/\/+$/, '')
  const normalizedLegacy = legacyPath.replace(/\/+$/, '')

  if (normalizedLegacy === normalizedCurrent) {
    return null
  }

  return legacyPath
}

async function migrateLegacyBackupDirectoryIfNeeded(): Promise<void> {
  if (legacyBackupDirectoryMigrationAttempted) {
    return
  }

  legacyBackupDirectoryMigrationAttempted = true

  const legacyDirectory = getLegacyMisresolvedBackupDirectory()
  if (!legacyDirectory) {
    return
  }

  const targetDirectory = getBackupDirectory()

  try {
    await fs.access(legacyDirectory)
  } catch {
    return
  }

  const entries = await fs.readdir(legacyDirectory, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const isBackupFile = BACKUP_FILE_PATTERN.test(entry.name)
    const isMetadataFile = entry.name === BACKUP_METADATA_FILE

    if (!isBackupFile && !isMetadataFile) {
      continue
    }

    const sourcePath = join(legacyDirectory, entry.name)
    const targetPath = join(targetDirectory, entry.name)

    try {
      await fs.access(targetPath)
      continue
    } catch {
      // El archivo no existe en destino, se copia desde la ruta legacy.
    }

    await fs.copyFile(sourcePath, targetPath)
  }
}

/**
 * Estado de operación actual de backups
 */
export function getCurrentBackupOperation(): BackupOperationType | null {
  return currentBackupOperation
}

function isBackupMetadataStatus(value: unknown): value is BackupMetadata['status'] {
  return value === 'success' || value === 'error'
}

function getBackupPathFromFilename(filename: string): string {
  return join(getBackupDirectory(), filename)
}

function getSqliteSidecarPaths(dbPath: string): string[] {
  return [`${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]
}

async function backupFileExists(filename: string): Promise<boolean> {
  const filePath = getBackupPathFromFilename(filename)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function normalizeDiskEntry(entry: BackupMetadataDiskEntry): BackupMetadata | null {
  if (typeof entry.id !== 'string' || typeof entry.filename !== 'string') {
    return null
  }

  const status = isBackupMetadataStatus(entry.status) ? entry.status : 'error'
  const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : new Date(0).toISOString()

  return {
    id: entry.id,
    filename: entry.filename,
    path: getBackupPathFromFilename(entry.filename),
    createdAt,
    size: typeof entry.size === 'number' ? entry.size : 0,
    compressedSize: typeof entry.compressedSize === 'number' ? entry.compressedSize : 0,
    checksum: typeof entry.checksum === 'string' ? entry.checksum : '',
    status,
    storeCount: typeof entry.storeCount === 'number' ? entry.storeCount : undefined,
    error: typeof entry.error === 'string' ? entry.error : undefined,
  }
}

async function withBackupOperationLock<T>(operation: BackupOperationType, fn: () => Promise<T>): Promise<T> {
  if (currentBackupOperation) {
    throw new BackupOperationInProgressError(currentBackupOperation)
  }

  currentBackupOperation = operation

  try {
    return await fn()
  } finally {
    currentBackupOperation = null
  }
}

function parseCreatedAtFromFilename(filename: string): string | null {
  const match = filename.match(
    /^backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.db\.gz$/
  )

  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute, second, milliseconds] = match
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(milliseconds)
  ))

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

async function discoverBackupFiles(): Promise<DiscoveredBackupFile[]> {
  await ensureBackupDirectoryExists()
  const backupDir = getBackupDirectory()
  const entries = await fs.readdir(backupDir, { withFileTypes: true })
  const discovered: DiscoveredBackupFile[] = []

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    if (!BACKUP_FILE_PATTERN.test(entry.name)) {
      continue
    }

    const filePath = join(backupDir, entry.name)
    const stats = await fs.stat(filePath)

    discovered.push({
      filename: entry.name,
      path: filePath,
      compressedSize: stats.size,
      createdAt: parseCreatedAtFromFilename(entry.name) || stats.mtime.toISOString(),
    })
  }

  return discovered
}

async function buildRecoveredMetadataFromFiles(): Promise<BackupMetadata[]> {
  const discovered = await discoverBackupFiles()
  const recovered: BackupMetadata[] = []

  for (const file of discovered) {
    const checksum = await calculateChecksum(file.path)
    recovered.push({
      id: file.filename.replace('.db.gz', ''),
      filename: file.filename,
      path: file.path,
      createdAt: file.createdAt,
      size: file.compressedSize,
      compressedSize: file.compressedSize,
      checksum,
      status: 'success',
      storeCount: -1,
    })
  }

  return recovered
}

function backupEntryScore(entry: BackupMetadata): number {
  let score = 0
  if (entry.status === 'success') score += 100
  if (entry.checksum) score += 20
  if (entry.size > 0) score += 10
  if (entry.compressedSize > 0) score += 5
  if (entry.storeCount !== undefined && entry.storeCount >= 0) score += 5
  return score
}

function deduplicateMetadataByFilename(
  metadata: BackupMetadata[]
): { metadata: BackupMetadata[]; changed: boolean } {
  const deduped = new Map<string, BackupMetadata>()
  let changed = false

  for (const entry of metadata) {
    const existing = deduped.get(entry.filename)
    if (!existing) {
      deduped.set(entry.filename, entry)
      continue
    }

    changed = true
    const keepCandidate = backupEntryScore(entry) > backupEntryScore(existing)
      || (backupEntryScore(entry) === backupEntryScore(existing) && entry.size > existing.size)

    if (keepCandidate) {
      deduped.set(entry.filename, entry)
    }
  }

  return {
    metadata: Array.from(deduped.values()),
    changed,
  }
}

async function synchronizeMetadataWithBackupFiles(
  metadata: BackupMetadata[]
): Promise<{ metadata: BackupMetadata[]; changed: boolean }> {
  const dedupResult = deduplicateMetadataByFilename(metadata)
  metadata = dedupResult.metadata

  const discovered = await discoverBackupFiles()
  const metadataByFilename = new Map(metadata.map((item) => [item.filename, item]))
  let changed = dedupResult.changed

  for (const item of metadata) {
    const normalizedPath = getBackupPathFromFilename(item.filename)
    if (item.path !== normalizedPath) {
      item.path = normalizedPath
      changed = true
    }
  }

  for (const file of discovered) {
    const existing = metadataByFilename.get(file.filename)

    if (!existing) {
      const checksum = await calculateChecksum(file.path)
      metadata.push({
        id: file.filename.replace('.db.gz', ''),
        filename: file.filename,
        path: file.path,
        createdAt: file.createdAt,
        size: file.compressedSize,
        compressedSize: file.compressedSize,
        checksum,
        status: 'success',
        storeCount: -1,
      })
      changed = true
      continue
    }

    if (!existing.createdAt) {
      existing.createdAt = file.createdAt
      changed = true
    }

    if (!existing.compressedSize || existing.compressedSize <= 0) {
      existing.compressedSize = file.compressedSize
      changed = true
    }

    if (!existing.size || existing.size <= 0) {
      existing.size = file.compressedSize
      changed = true
    }

    if (existing.status === 'success' && !existing.checksum) {
      existing.checksum = await calculateChecksum(file.path)
      changed = true
    }
  }

  return { metadata, changed }
}

/**
 * Obtener la ruta del archivo de base de datos
 */
export function getDatabasePath(): string {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl || !dbUrl.startsWith('file:')) {
    throw new Error('DATABASE_URL debe ser un archivo local')
  }

  // Remover 'file:' del inicio, descartar query params y decodificar URL encoding
  const dbPath = decodeURIComponent(dbUrl.substring(5).split('?')[0])
  if (isAbsolute(dbPath)) {
    return dbPath
  }

  // Prisma resuelve rutas SQLite relativas al schema.prisma (usualmente en ./prisma)
  const cwdResolvedPath = join(process.cwd(), dbPath)
  if (existsSync(cwdResolvedPath)) {
    return cwdResolvedPath
  }

  const prismaSchemaResolvedPath = join(process.cwd(), 'prisma', dbPath)
  if (existsSync(prismaSchemaResolvedPath)) {
    return prismaSchemaResolvedPath
  }

  // Fallback para mantener comportamiento previo si el archivo aún no existe
  return cwdResolvedPath
}

/**
 * Asegurar que el directorio de backups existe
 */
export async function ensureBackupDirectoryExists(): Promise<void> {
  const backupDir = getBackupDirectory()
  try {
    await fs.access(backupDir)
  } catch {
    await fs.mkdir(backupDir, { recursive: true })
  }

  await migrateLegacyBackupDirectoryIfNeeded()
}

/**
 * Calcular checksum SHA256 de un archivo
 */
export async function calculateChecksum(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Copiar archivo de base de datos
 */
export async function copyDatabaseFile(sourcePath: string, destPath: string): Promise<void> {
  try {
    await fs.copyFile(sourcePath, destPath)
  } catch (error) {
    throw new Error(`Error copiando base de datos: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

/**
 * Comprimir archivo con gzip
 */
export async function compressBackup(inputPath: string, outputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const input = createReadStream(inputPath)
    const output = createWriteStream(outputPath)
    const gzip = createGzip()

    output.on('finish', () => {
      fs.stat(outputPath)
        .then((stats) => resolve(stats.size))
        .catch(reject)
    })

    gzip.on('error', reject)
    input.on('error', reject)
    output.on('error', reject)

    input.pipe(gzip).pipe(output)
  })
}

/**
 * Descomprimir archivo gzip
 */
export async function decompressBackup(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = createReadStream(inputPath)
    const output = createWriteStream(outputPath)
    const gunzip = createGunzip()

    output.on('finish', () => resolve())
    gunzip.on('error', reject)
    input.on('error', reject)
    output.on('error', reject)

    input.pipe(gunzip).pipe(output)
  })
}

/**
 * Desconectar todas las conexiones de Prisma
 */
export async function disconnectPrismaConnections(): Promise<void> {
  try {
    await prisma.$disconnect()
    await new Promise(resolve => setTimeout(resolve, 100))
  } catch (error) {
    console.warn('Error desconectando Prisma:', error)
  }
}

/**
 * Leer metadatos de backups
 */
export async function readBackupMetadata(): Promise<BackupMetadata[]> {
  const metadataPath = join(getBackupDirectory(), BACKUP_METADATA_FILE)

  try {
    const data = await fs.readFile(metadataPath, 'utf-8')
    const parsed = JSON.parse(data)

    if (!Array.isArray(parsed)) {
      const recovered = await buildRecoveredMetadataFromFiles()
      if (recovered.length > 0) {
        await saveBackupMetadata(recovered)
      }
      return recovered
    }

    const normalizedMetadata = parsed
      .map((entry) => normalizeDiskEntry(entry as BackupMetadataDiskEntry))
      .filter((entry): entry is BackupMetadata => entry !== null)

    const shouldRewrite = normalizedMetadata.length !== parsed.length || parsed.some((entry, index) => {
      const normalizedEntry = normalizedMetadata[index]
      return !normalizedEntry || typeof (entry as BackupMetadataDiskEntry).path !== 'string' || (entry as BackupMetadataDiskEntry).path !== normalizedEntry.path
    })

    const { metadata: synchronizedMetadata, changed } = await synchronizeMetadataWithBackupFiles(normalizedMetadata)

    if (shouldRewrite || changed) {
      await saveBackupMetadata(synchronizedMetadata)
    }

    return synchronizedMetadata
  } catch {
    const recovered = await buildRecoveredMetadataFromFiles()
    if (recovered.length > 0) {
      await saveBackupMetadata(recovered)
    }
    return recovered
  }
}

/**
 * Guardar metadatos de backups
 */
export async function saveBackupMetadata(metadata: BackupMetadata[]): Promise<void> {
  await ensureBackupDirectoryExists()
  const metadataPath = join(getBackupDirectory(), BACKUP_METADATA_FILE)
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
}

/**
 * Agregar backup a metadatos
 */
export async function addBackupMetadata(backup: BackupMetadata): Promise<void> {
  const existing = await readBackupMetadata()
  existing.push({
    ...backup,
    path: getBackupPathFromFilename(backup.filename),
  })
  await saveBackupMetadata(existing)
}

/**
 * Generar nombre de archivo para backup
 */
export function generateBackupFilename(): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .split('.')[0]

  return `backup-${timestamp}.db.gz`
}

/**
 * Crear backup completo
 */
export async function createBackup(): Promise<BackupMetadata> {
  return withBackupOperationLock('backup', async () => {
    const dbPath = getDatabasePath()
    const filename = generateBackupFilename()
    const backupPath = getBackupPathFromFilename(filename)
    const tempDbPath = join(getBackupDirectory(), `temp-${Date.now()}.db`)
    let prismaDisconnected = false

    try {
      await ensureBackupDirectoryExists()
      await fs.access(dbPath)

      const stats = await fs.stat(dbPath)
      const originalSize = stats.size

      const storeCount = await prisma.store.count()

      await disconnectPrismaConnections()
      prismaDisconnected = true
      await copyDatabaseFile(dbPath, tempDbPath)

      const compressedSize = await compressBackup(tempDbPath, backupPath)
      const checksum = await calculateChecksum(backupPath)

      const backupMetadata: BackupMetadata = {
        id: filename.replace('.db.gz', ''),
        filename,
        path: backupPath,
        createdAt: new Date().toISOString(),
        size: originalSize,
        compressedSize,
        checksum,
        status: 'success',
        storeCount,
      }

      await addBackupMetadata(backupMetadata)
      await fs.unlink(tempDbPath)

      return backupMetadata
    } catch (error) {
      try {
        await fs.unlink(tempDbPath)
      } catch {
        // Ignorar errores de limpieza
      }

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      throw new Error(`Error creando backup: ${errorMessage}`)
    } finally {
      if (prismaDisconnected) {
        try {
          await prisma.$connect()
        } catch (connectError) {
          console.warn('No se pudo reconectar Prisma después del backup:', connectError)
        }
      }
    }
  })
}

/**
 * Listar todos los backups disponibles
 */
export async function listBackups(): Promise<BackupList> {
  const metadata = await readBackupMetadata()

  const successfulBackups: BackupMetadata[] = []
  for (const backup of metadata) {
    if (backup.status !== 'success') {
      continue
    }

    if (await backupFileExists(backup.filename)) {
      successfulBackups.push({
        ...backup,
        path: getBackupPathFromFilename(backup.filename),
      })
    }
  }

  successfulBackups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const totalSize = successfulBackups.reduce((sum, backup) => sum + backup.compressedSize, 0)
  const lastBackup = successfulBackups.length > 0 ? successfulBackups[0].createdAt : undefined

  return {
    backups: successfulBackups,
    totalSize,
    lastBackup,
  }
}

/**
 * Verificar integridad de un backup
 */
export async function verifyBackupIntegrity(backupPath: string, expectedChecksum: string): Promise<boolean> {
  try {
    const actualChecksum = await calculateChecksum(backupPath)
    return actualChecksum === expectedChecksum
  } catch {
    return false
  }
}

/**
 * Restaurar backup
 */
export async function restoreBackup(backupId: string): Promise<BackupMetadata> {
  return withBackupOperationLock('restore', async () => {
    console.log(`🔄 Iniciando restauración del backup: ${backupId}`)

    const metadata = await readBackupMetadata()
    const backup = metadata.find(b => b.id === backupId && b.status === 'success')

    if (!backup) {
      throw new Error(`Backup ${backupId} no encontrado`)
    }

    const backupPath = getBackupPathFromFilename(backup.filename)

    try {
      await fs.access(backupPath)
    } catch {
      throw new Error(`Archivo de backup ${backup.filename} no encontrado`)
    }

    const isValid = await verifyBackupIntegrity(backupPath, backup.checksum)
    if (!isValid) {
      throw new Error(`Backup ${backupId} está corrupto (checksum inválido)`)
    }

    const dbPath = getDatabasePath()
    const tempBackupPath = join(dirname(dbPath), `backup-restore-${Date.now()}.db`)
    const tempRestoredPath = join(dirname(dbPath), `temp-restored-${Date.now()}.db`)
    const sqliteSidecarPaths = getSqliteSidecarPaths(dbPath)

    enableRestoreMaintenanceMode()

    try {
      await copyDatabaseFile(dbPath, tempBackupPath)
      await disconnectPrismaConnections()

      for (const sidecarPath of sqliteSidecarPaths) {
        try {
          await fs.unlink(sidecarPath)
        } catch {
          // Ignorar archivos sidecar inexistentes
        }
      }

      await decompressBackup(backupPath, tempRestoredPath)

      const restoredStats = await fs.stat(tempRestoredPath)
      if (restoredStats.size === 0) {
        throw new Error('Archivo restaurado está vacío')
      }

      try {
        await fs.rename(tempRestoredPath, dbPath)
      } catch {
        await fs.copyFile(tempRestoredPath, dbPath)
        await fs.unlink(tempRestoredPath)
      }

      for (const sidecarPath of sqliteSidecarPaths) {
        try {
          await fs.unlink(sidecarPath)
        } catch {
          // Ignorar archivos sidecar inexistentes
        }
      }

      await prisma.$connect()

      return {
        ...backup,
        path: backupPath,
      }
    } catch (error) {
      try {
        if (existsSync(tempBackupPath)) {
          await fs.copyFile(tempBackupPath, dbPath)
        }

        for (const sidecarPath of sqliteSidecarPaths) {
          try {
            await fs.unlink(sidecarPath)
          } catch {
            // Ignorar archivos sidecar inexistentes
          }
        }

        await prisma.$connect()
      } catch (restoreError) {
        console.error('❌ Error restaurando backup preventivo:', restoreError)
      }

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      throw new Error(`Error restaurando backup: ${errorMessage}`)
    } finally {
      try {
        if (existsSync(tempBackupPath)) {
          await fs.unlink(tempBackupPath)
        }
      } catch {
        // Ignorar limpieza
      }

      try {
        if (existsSync(tempRestoredPath)) {
          await fs.unlink(tempRestoredPath)
        }
      } catch {
        // Ignorar limpieza
      }

      disableRestoreMaintenanceMode()
    }
  })
}

/**
 * Eliminar backup (útil para limpieza)
 */
export async function deleteBackup(backupId: string): Promise<void> {
  const metadata = await readBackupMetadata()
  const backupIndex = metadata.findIndex(b => b.id === backupId)

  if (backupIndex === -1) {
    throw new Error(`Backup ${backupId} no encontrado`)
  }

  const backup = metadata[backupIndex]

  try {
    await fs.unlink(getBackupPathFromFilename(backup.filename))
  } catch (error) {
    console.warn(`Error eliminando archivo ${backup.filename}:`, error)
  }

  metadata.splice(backupIndex, 1)
  await saveBackupMetadata(metadata)
}

/**
 * Obtener información de espacio en disco
 */
export async function getDiskSpaceInfo(): Promise<{ available: number; total: number }> {
  return {
    available: 1024 * 1024 * 1024,
    total: 10 * 1024 * 1024 * 1024,
  }
}
