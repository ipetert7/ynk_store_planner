'use client'

import { useUsers } from '@/hooks/useUsers'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function UserStatsSummary() {
  const { users, loading } = useUsers()

  const adminCount = users.filter(u => u.role === 'ADMINISTRADOR').length
  const gestorCount = users.filter(u => u.role === 'GESTOR').length
  const visualizadorCount = users.filter(u => u.role === 'VISUALIZADOR').length

  return (
    <Card>
      <CardContent className="py-6 px-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">
              Gestión de Usuarios
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Administra los usuarios del sistema, sus roles y permisos de acceso
            </p>
            {loading ? (
              <div className="mt-4">
                <LoadingSpinner size="sm" text="Cargando estadísticas..." />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Total de Usuarios</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {users.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Administradores</p>
                  <p className="text-lg font-semibold text-red-600 mt-1">
                    {adminCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gestores</p>
                  <p className="text-lg font-semibold text-blue-600 mt-1">
                    {gestorCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Visualizadores</p>
                  <p className="text-lg font-semibold text-green-600 mt-1">
                    {visualizadorCount}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="ml-6">
            <Link href="/settings/users">
              <Button variant="primary" size="lg">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                Gestionar Usuarios
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
