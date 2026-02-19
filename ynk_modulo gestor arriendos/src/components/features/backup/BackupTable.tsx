'use client'

import { useState } from 'react'
import RestoreBackupModal from './RestoreBackupModal'
import DeleteBackupModal from './DeleteBackupModal'

interface BackupData {
  id: string
  filename: string
  createdAt: string
  size: number
  compressedSize: number
  checksum: string
  storeCount?: number
}

interface BackupTableProps {
  backups: BackupData[]
  onRestore: (backupId: string) => Promise<any>
  onDelete: (backupId: string) => Promise<any>
  isLoading?: boolean
  error?: string | null
}

export default function BackupTable({
  backups,
  onRestore,
  onDelete,
  isLoading = false,
  error = null,
}: BackupTableProps) {
  const [restoreModal, setRestoreModal] = useState<{
    isOpen: boolean
    backup: BackupData | null
  }>({
    isOpen: false,
    backup: null,
  })

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    backup: BackupData | null
  }>({
    isOpen: false,
    backup: null,
  })

  const [modalLoading, setModalLoading] = useState(false)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return { value: 0, unit: 'B' }
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return {
      value: parseFloat((bytes / Math.pow(k, i)).toFixed(2)),
      unit: sizes[i],
    }
  }

  const calculateRatio = (original: number, compressed: number) => {
    if (original === 0) return 0
    return ((original - compressed) / original * 100).toFixed(1)
  }

  const handleRestore = async (backupId: string) => {
    setModalLoading(true)
    try {
      return await onRestore(backupId)
    } finally {
      setModalLoading(false)
    }
  }

  const handleDelete = async (backupId: string) => {
    setModalLoading(true)
    try {
      return await onDelete(backupId)
    } finally {
      setModalLoading(false)
    }
  }

  const openRestoreModal = (backup: BackupData) => {
    setRestoreModal({ isOpen: true, backup })
  }

  const closeRestoreModal = () => {
    setRestoreModal({ isOpen: false, backup: null })
  }

  const openDeleteModal = (backup: BackupData) => {
    setDeleteModal({ isOpen: true, backup })
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, backup: null })
  }

  if (backups.length === 0) {
    if (error) {
      return (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4m0 4h.01M4.93 19.07A10 10 0 1119.07 4.93 10 10 0 014.93 19.07z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No se pudieron cargar backups</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      )
    }

    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay backups</h3>
        <p className="mt-1 text-sm text-gray-500">
          Crea tu primer backup para comenzar a proteger tus datos.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha y Hora
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tiendas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tamaño Original
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tamaño Comprimido
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Compresión
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Checksum
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {backups.map((backup, index) => {
              const dateTime = formatDate(backup.createdAt)
              const originalSize = formatBytes(backup.size)
              const compressedSize = formatBytes(backup.compressedSize)
              const compressionRatio = calculateRatio(backup.size, backup.compressedSize)

              return (
                <tr key={backup.id} className={index === 0 ? 'bg-green-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {index === 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                          Último
                        </span>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {dateTime.date}
                        </div>
                        <div className="text-sm text-gray-500">
                          {dateTime.time}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {backup.storeCount !== undefined
                      ? backup.storeCount === -1
                        ? 'Desconocido'
                        : backup.storeCount
                      : 'N/A'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {originalSize.value} {originalSize.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {compressedSize.value} {compressedSize.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      -{compressionRatio}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    <div className="max-w-xs truncate" title={backup.checksum}>
                      {backup.checksum.substring(0, 12)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openRestoreModal(backup)}
                        disabled={isLoading || modalLoading}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Restaurar
                      </button>
                      <button
                        onClick={() => openDeleteModal(backup)}
                        disabled={isLoading || modalLoading}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <RestoreBackupModal
        isOpen={restoreModal.isOpen}
        onClose={closeRestoreModal}
        backup={restoreModal.backup}
        onRestore={handleRestore}
        isLoading={modalLoading}
      />

      <DeleteBackupModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        backup={deleteModal.backup}
        onDelete={handleDelete}
        isLoading={modalLoading}
      />
    </>
  )
}
