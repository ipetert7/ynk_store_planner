'use client'

import { useBackups } from '@/hooks/useBackups'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function BackupSummary() {
  const { summary, isLoading } = useBackups()

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
    <Card>
      <CardContent className="py-6 px-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">
              Gestión de Backups
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Crea, administra y restaura copias de seguridad de tu base de datos
            </p>
            {isLoading ? (
              <div className="mt-4">
                <LoadingSpinner size="sm" text="Cargando estadísticas..." />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Total de Backups</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {summary.totalBackups}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Espacio Total</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {formatBytes(summary.totalSize)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Último Backup</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {formatDate(summary.lastBackup || '')}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="ml-6">
            <Link href="/settings/backups">
              <Button variant="primary" size="lg">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Gestionar Backups
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

