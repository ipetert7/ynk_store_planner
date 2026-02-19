import { BackupMetadata, BackupList } from '@/lib/backup'
import { resolveApiPath } from '@/lib/api/paths'

export interface CreateBackupResponse {
  success: boolean
  message: string
  backup: {
    id: string
    filename: string
    createdAt: string
    size: number
    compressedSize: number
    checksum: string
    storeCount: number
  }
}

export interface RestoreBackupResponse {
  success: boolean
  message: string
  backup: {
    id: string
    filename: string
    createdAt: string
    size: number
    checksum: string
  }
}

export interface DeleteBackupResponse {
  success: boolean
  message: string
  deletedId: string
}

export interface ListBackupsResponse {
  success: boolean
  backups: {
    id: string
    filename: string
    createdAt: string
    size: number
    compressedSize: number
    checksum: string
    storeCount?: number
  }[]
  summary: {
    totalBackups: number
    totalSize: number
    lastBackup?: string
  }
}

export interface BackupError {
  success: false
  error: string
  details?: string
  code?: string
}

/**
 * Crear backup manual
 */
export async function createBackup(): Promise<CreateBackupResponse | BackupError> {
  try {
    const response = await fetch(resolveApiPath('/api/backups/create'), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Error creando backup',
        details: data.details,
        code: data.error,
      }
    }

    return data
  } catch (error) {
    return {
      success: false,
      error: 'Error de conexión',
      details: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Listar todos los backups disponibles
 */
export async function listBackups(): Promise<ListBackupsResponse | BackupError> {
  try {
    const response = await fetch(resolveApiPath('/api/backups'), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    })
    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Error obteniendo backups',
        details: data.details,
        code: data.error,
      }
    }

    return data
  } catch (error) {
    return {
      success: false,
      error: 'Error de conexión',
      details: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Restaurar backup específico
 */
export async function restoreBackup(backupId: string): Promise<RestoreBackupResponse | BackupError> {
  try {
    const response = await fetch(resolveApiPath('/api/backups/restore'), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ backupId }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Error restaurando backup',
        details: data.details,
        code: data.error,
      }
    }

    return data
  } catch (error) {
    return {
      success: false,
      error: 'Error de conexión',
      details: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Eliminar backup específico
 */
export async function deleteBackup(backupId: string): Promise<DeleteBackupResponse | BackupError> {
  try {
    const response = await fetch(resolveApiPath(`/api/backups/${backupId}`), {
      method: 'DELETE',
      cache: 'no-store',
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Error eliminando backup',
        details: data.details,
        code: data.error,
      }
    }

    return data
  } catch (error) {
    return {
      success: false,
      error: 'Error de conexión',
      details: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Verificar si hay backups disponibles
 */
export async function hasBackups(): Promise<boolean> {
  const result = await listBackups()
  return result.success && result.backups.length > 0
}

/**
 * Obtener el último backup disponible
 */
export async function getLatestBackup(): Promise<BackupMetadata | null> {
  const result = await listBackups()
  if (!result.success || result.backups.length === 0) {
    return null
  }

  // Los backups ya vienen ordenados por fecha descendente
  const latestBackupData = result.backups[0]

  return {
    id: latestBackupData.id,
    filename: latestBackupData.filename,
    path: '', // No disponible desde API
    createdAt: latestBackupData.createdAt,
    size: latestBackupData.size,
    compressedSize: latestBackupData.compressedSize,
    checksum: latestBackupData.checksum,
    status: 'success', // Asumimos que todos los listados son exitosos
  }
}
