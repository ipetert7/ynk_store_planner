import { useState, useEffect, useCallback } from 'react'
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  hasBackups,
  getLatestBackup,
  type ListBackupsResponse,
  type CreateBackupResponse,
  type RestoreBackupResponse,
  type DeleteBackupResponse,
} from '@/lib/api/backups'

function buildErrorMessage(result: unknown): string {
  if (!result || typeof result !== 'object') return 'Error desconocido'

  const error = 'error' in result && typeof result.error === 'string' ? result.error : undefined
  const details = 'details' in result && typeof result.details === 'string' ? result.details : undefined

  if (!error && !details) return 'Error desconocido'
  if (error && details) return `${error}: ${details}`
  return error || details || 'Error desconocido'
}

export interface UseBackupsReturn {
  // Estado
  backups: ListBackupsResponse['backups']
  isLoading: boolean
  error: string | null
  summary: ListBackupsResponse['summary']

  // Operaciones
  refreshBackups: () => Promise<void>
  handleCreateBackup: () => Promise<CreateBackupResponse | null>
  handleRestoreBackup: (backupId: string) => Promise<RestoreBackupResponse | null>
  handleDeleteBackup: (backupId: string) => Promise<DeleteBackupResponse | null>

  // Utilidades
  checkHasBackups: () => Promise<boolean>
  getLatestBackupData: () => Promise<any | null>
}

export function useBackups(): UseBackupsReturn {
  const [backups, setBackups] = useState<ListBackupsResponse['backups']>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ListBackupsResponse['summary']>({
    totalBackups: 0,
    totalSize: 0,
  })

  // Función para refrescar la lista de backups
  const refreshBackups = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await listBackups()

      if (result.success) {
        setBackups(result.backups)
        setSummary(result.summary)
      } else {
        setError(buildErrorMessage(result))
        setBackups([])
        setSummary({ totalBackups: 0, totalSize: 0 })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(`Error cargando backups: ${errorMessage}`)
      setBackups([])
      setSummary({ totalBackups: 0, totalSize: 0 })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Cargar backups al montar el componente
  useEffect(() => {
    refreshBackups()
  }, [refreshBackups])

  // Crear backup manual
  const handleCreateBackup = useCallback(async (): Promise<CreateBackupResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await createBackup()

      if (result.success) {
        // Refrescar la lista después de crear
        await refreshBackups()
        return result
      } else {
        setError(buildErrorMessage(result))
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(`Error creando backup: ${errorMessage}`)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [refreshBackups])

  // Restaurar backup
  const handleRestoreBackup = useCallback(async (backupId: string): Promise<RestoreBackupResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await restoreBackup(backupId)

      if (result.success) {
        // Refrescar la lista después de restaurar (por si cambia algo)
        await refreshBackups()
        return result
      } else {
        setError(buildErrorMessage(result))
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(`Error restaurando backup: ${errorMessage}`)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [refreshBackups])

  // Eliminar backup
  const handleDeleteBackup = useCallback(async (backupId: string): Promise<DeleteBackupResponse | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await deleteBackup(backupId)

      if (result.success) {
        // Refrescar la lista después de eliminar
        await refreshBackups()
        return result
      } else {
        setError(buildErrorMessage(result))
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(`Error eliminando backup: ${errorMessage}`)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [refreshBackups])

  // Verificar si hay backups
  const checkHasBackups = useCallback(async (): Promise<boolean> => {
    try {
      return await hasBackups()
    } catch {
      return false
    }
  }, [])

  // Obtener el último backup
  const getLatestBackupData = useCallback(async () => {
    try {
      return await getLatestBackup()
    } catch {
      return null
    }
  }, [])

  return {
    backups,
    isLoading,
    error,
    summary,
    refreshBackups,
    handleCreateBackup,
    handleRestoreBackup,
    handleDeleteBackup,
    checkHasBackups,
    getLatestBackupData,
  }
}
