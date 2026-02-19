'use client'

import { useBackups } from '@/hooks/useBackups'
import CreateBackupButton from './CreateBackupButton'
import BackupTable from './BackupTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

export default function BackupManagement() {
  const {
    backups,
    isLoading,
    error,
    summary,
    handleCreateBackup,
    handleRestoreBackup,
    handleDeleteBackup,
  } = useBackups()

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Nunca'
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Gestión de Backups
        </h1>
        <p className="text-gray-600">
          Crea, administra y restaura copias de seguridad de tu base de datos.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium text-gray-600">
              Total de Backups
            </h3>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalBackups}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium text-gray-600">
              Espacio Total Usado
            </h3>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatBytes(summary.totalSize)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium text-gray-600">
              Último Backup
            </h3>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-gray-900">
              {formatDate(summary.lastBackup || '')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Backup Section */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Crear Backup Manual</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Crea una copia de seguridad inmediata de tu base de datos actual.
              Los backups se comprimen automáticamente para ahorrar espacio.
            </p>
            <CreateBackupButton
              onCreateBackup={handleCreateBackup}
              isLoading={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Backups Table */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Backups Disponibles</h3>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md">
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

          {isLoading && backups.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" text="Cargando backups..." />
            </div>
          ) : (
            <BackupTable
              backups={backups}
              onRestore={handleRestoreBackup}
              onDelete={handleDeleteBackup}
              isLoading={isLoading}
              error={error}
            />
          )}
        </CardContent>
      </Card>

      {/* Information Section */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Información Importante</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Backups Automáticos</p>
                <p>Además de los backups manuales, el sistema crea backups automáticos diariamente a las 03:00.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Compresión Automática</p>
                <p>Los backups se comprimen con gzip, reduciendo típicamente el tamaño en un 50-80%.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Restauración Destructiva</p>
                <p>Restaurar un backup reemplaza completamente la base de datos actual. Se crea un backup del estado actual antes de restaurar.</p>
                <p className="mt-1 text-sm"><strong>Importante:</strong> Durante la restauración, algunas operaciones pueden responder temporalmente con error hasta que finalice el proceso.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
