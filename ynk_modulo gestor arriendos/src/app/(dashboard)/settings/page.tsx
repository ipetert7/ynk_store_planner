'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import BackupSummary from '@/components/features/backup/BackupSummary'
import UserStatsSummary from '@/components/features/users/UserStatsSummary'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { isAdmin, isManagerOrAdmin } from '@/lib/utils/permissions'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') {
      // Esperar a que NextAuth termine de cargar
      return
    }

    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Cargando..." />
      </div>
    )
  }

  if (status === 'unauthenticated' || !session) {
    return null // Redireccionará en el useEffect
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Ajustes
        </h1>
        <p className="text-gray-600">
          Configura y administra los ajustes de la plataforma
        </p>
      </div>

      {/* Gestión de Usuarios - Solo para administradores */}
      {isAdmin(session) && <UserStatsSummary />}

      {/* Importación Masiva de Tiendas - Para gestores y administradores */}
      {isManagerOrAdmin(session) && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">
              Importación Masiva de Tiendas
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Importa múltiples tiendas desde un archivo Excel de forma automática
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  Sube un archivo Excel con la información de tus tiendas.
                  El sistema detectará duplicados y te permitirá elegir cómo proceder con cada uno.
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  • Formato: .xlsx o .xls (máx. 10MB)<br/>
                  • Columnas requeridas: ID, Nombre Tienda, Banner, Superficie Sala, Superficie Total, Operador, Fechas de contrato, VMM, Porcentaje
                </div>
              </div>
              <div className="ml-6">
                <Link href="/settings/import">
                  <Button variant="primary">
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Importar Tiendas
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gestión de Backups */}
      <BackupSummary />
    </div>
  )
}
