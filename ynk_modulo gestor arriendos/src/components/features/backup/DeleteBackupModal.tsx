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
  storeCount?: number
}

interface DeleteBackupModalProps {
  isOpen: boolean
  onClose: () => void
  backup: BackupData | null
  onDelete: (backupId: string) => Promise<any>
  isLoading?: boolean
}

export default function DeleteBackupModal({
  isOpen,
  onClose,
  backup,
  onDelete,
  isLoading = false,
}: DeleteBackupModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const requiredText = backup?.id.substring(0, 8) || ''

  const handleDelete = async () => {
    if (!backup || confirmText !== requiredText) return

    setError(null)

    try {
      const result = await onDelete(backup.id)

      if (result?.success) {
        onClose()
        // Reset form
        setConfirmText('')
      } else {
        setError(result?.error || 'Error eliminando backup')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  const handleClose = () => {
    onClose()
    setConfirmText('')
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
      title="Eliminar Backup"
      size="md"
    >
      <div className="space-y-6">
        {backup && (
          <>
            {/* Información del backup */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-900">Backup a eliminar</h3>
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
                  <span className="font-medium text-gray-700">Tamaño comprimido:</span>
                  <p className="text-gray-900">{formatBytes(backup.compressedSize)}</p>
                </div>
              </div>
            </div>

            {/* Advertencia */}
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
                    ¿Estás seguro?
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Esta acción eliminará permanentemente el archivo de backup.
                      No podrás recuperar este backup después de eliminarlo.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmación */}
            <div className="space-y-3">
              <label htmlFor="confirm-delete" className="block text-sm font-medium text-gray-700">
                Para confirmar, escribe los primeros 8 caracteres del ID del backup:
                <span className="font-mono font-bold text-gray-900"> {requiredText}</span>
              </label>
              <input
                id="confirm-delete"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                placeholder="Escribe el código de confirmación"
              />
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
                onClick={handleDelete}
                isLoading={isLoading}
                disabled={confirmText !== requiredText || isLoading}
              >
                {isLoading ? 'Eliminando...' : 'Eliminar Backup'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
