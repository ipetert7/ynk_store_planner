'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface BackupData {
  id: string
  filename: string
  createdAt: string
  size: number
  compressedSize: number
  checksum: string
  storeCount?: number
}

interface RestoreBackupModalProps {
  isOpen: boolean
  onClose: () => void
  backup: BackupData | null
  onRestore: (backupId: string) => Promise<any>
  isLoading?: boolean
}

export default function RestoreBackupModal({
  isOpen,
  onClose,
  backup,
  onRestore,
  isLoading = false,
}: RestoreBackupModalProps) {
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRestore = async () => {
    if (!backup || !isConfirmed) return

    setError(null)

    try {
      const result = await onRestore(backup.id)

      if (result?.success) {
        onClose()
        // Reset confirmation
        setIsConfirmed(false)
      } else {
        setError(result?.error || 'Error restaurando backup')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  const handleClose = () => {
    onClose()
    setIsConfirmed(false)
    setError(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Restaurar Backup"
      size="lg"
    >
      <div className="space-y-6">
        {backup && (
          <>
            {/* Información del backup */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-900">Información del backup</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">ID:</span>
                  <p className="text-gray-900 font-mono">{backup.id}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Fecha:</span>
                  <p className="text-gray-900">{formatDate(backup.createdAt)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Tiendas:</span>
                  <p className="text-gray-900">
                    {backup.storeCount !== undefined
                      ? backup.storeCount === -1
                        ? 'Desconocido'
                        : backup.storeCount
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Tamaño original:</span>
                  <p className="text-gray-900">{formatBytes(backup.size)}</p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-gray-700">Tamaño comprimido:</span>
                  <p className="text-gray-900">{formatBytes(backup.compressedSize)}</p>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Checksum:</span>
                <p className="text-gray-900 font-mono text-xs break-all">
                  {backup.checksum}
                </p>
              </div>
            </div>

            {/* Advertencia */}
            <div className="space-y-4">
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Advertencia importante
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        Esta acción reemplazará completamente la base de datos actual con el contenido de este backup.
                        Todos los cambios realizados después de la fecha del backup se perderán permanentemente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Antes de restaurar
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Para evitar errores de restauración, asegúrese de que:
                      </p>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        <li>Evite ejecutar múltiples restauraciones al mismo tiempo</li>
                        <li>No haya usuarios activos usando la aplicación</li>
                        <li>Las operaciones de escritura pueden bloquearse temporalmente durante el proceso</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmación */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="confirm-restore"
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="confirm-restore" className="font-medium text-gray-700">
                  Confirmo que entiendo las consecuencias y quiero restaurar este backup
                </label>
                <p className="text-gray-500">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleRestore}
                isLoading={isLoading}
                disabled={!isConfirmed || isLoading}
              >
                {isLoading ? 'Restaurando...' : 'Restaurar Backup'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
