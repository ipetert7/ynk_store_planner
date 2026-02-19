'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { User } from '@/hooks/useUsers'
import { useUsers } from '@/hooks/useUsers'
import { UserFormData } from '@/components/features/users/UserForm'
import { UserRole } from '@/lib/utils/permissions'
import ProtectedRoute from '@/components/ProtectedRoute'
import UserManagement from '@/components/features/users/UserManagement'
import UserForm from '@/components/features/users/UserForm'
import DeleteUserModal from '@/components/features/users/DeleteUserModal'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const {
    users,
    loading,
    error,
    creating,
    updating,
    deleting,
    createUser,
    updateUser,
    deleteUser,
    clearError,
  } = useUsers()

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }
  }, [status, session, router])

  const handleCreateUser = async (userData: UserFormData) => {
    await createUser({
      email: userData.email,
      password: userData.password || '',
      name: userData.name,
      role: userData.role,
    })
    clearError()
  }

  const handleUpdateUser = async (userData: UserFormData) => {
    if (!editingUser) return

    await updateUser(editingUser.id, userData)
    setEditingUser(null)
    clearError()
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return

    const success = await deleteUser(deletingUser.id)
    if (success) {
      setDeletingUser(null)
    }
    clearError()
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
  }

  const closeEditModal = () => {
    setEditingUser(null)
  }

  const openDeleteModal = (user: User) => {
    setDeletingUser(user)
  }

  const closeDeleteModal = () => {
    setDeletingUser(null)
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Cargando..." />
      </div>
    )
  }

  if (status === 'unauthenticated' || !session) {
    return null
  }

  return (
    <ProtectedRoute requiredRole={UserRole.ADMINISTRADOR}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Gestión de Usuarios
            </h1>
            <p className="text-gray-600 mt-1">
              Administra los usuarios del sistema y sus permisos de acceso
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear Usuario
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4 px-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Usuarios
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {loading ? '...' : users.length}
                  </dd>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 px-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Administradores
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {loading ? '...' : users.filter(u => u.role === 'ADMINISTRADOR').length}
                  </dd>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 px-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Gestores
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {loading ? '...' : users.filter(u => u.role === 'GESTOR').length}
                  </dd>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de usuarios */}
        <div>
          <UserManagement
            users={users}
            loading={loading}
            onEdit={openEditModal}
            onDelete={openDeleteModal}
          />
        </div>

        {/* Modal de creación */}
        <UserForm
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateUser}
          mode="create"
          loading={creating}
          error={error}
        />

        {/* Modal de edición */}
        <UserForm
          isOpen={!!editingUser}
          onClose={closeEditModal}
          onSubmit={handleUpdateUser}
          user={editingUser}
          mode="edit"
          loading={updating}
          error={error}
        />

        {/* Modal de eliminación */}
        <DeleteUserModal
          isOpen={!!deletingUser}
          onClose={closeDeleteModal}
          onConfirm={handleDeleteUser}
          user={deletingUser}
          loading={deleting}
          error={error}
        />
      </div>
    </ProtectedRoute>
  )
}
