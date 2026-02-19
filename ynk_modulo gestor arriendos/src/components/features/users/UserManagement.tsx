'use client'

import { useState } from 'react'
import { User } from '@/hooks/useUsers'
import { getRoleDisplayName } from '@/lib/utils/permissions'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'

interface UserManagementProps {
  users: User[]
  loading: boolean
  onEdit: (user: User) => void
  onDelete: (user: User) => void
}

export default function UserManagement({
  users,
  loading,
  onEdit,
  onDelete,
}: UserManagementProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMINISTRADOR':
        return 'danger'
      case 'GESTOR':
        return 'warning'
      case 'VISUALIZADOR':
        return 'success'
      default:
        return 'default'
    }
  }

  if (loading) {
    return (
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Fecha Creación
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <Skeleton height={20} width={120} />
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <Skeleton height={20} width={150} />
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <Skeleton height={24} width={80} />
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <Skeleton height={20} width={100} />
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Skeleton height={32} width={60} />
                      <Skeleton height={32} width={60} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="p-16 text-center">
          <div className="max-w-md mx-auto">
            <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              No hay usuarios registrados
            </h3>
            <p className="text-gray-600 mb-8 text-base">
              Comienza creando el primer usuario del sistema.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Fecha Creación
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    {user.name || 'Sin nombre'}
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="text-sm text-gray-600">
                    {user.email}
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <Badge
                    variant={getRoleBadgeVariant(user.role)}
                    size="sm"
                  >
                    {getRoleDisplayName(user.role as any)}
                  </Badge>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="text-sm text-gray-600">
                    {formatDate(user.createdAt)}
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(user)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(user)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
