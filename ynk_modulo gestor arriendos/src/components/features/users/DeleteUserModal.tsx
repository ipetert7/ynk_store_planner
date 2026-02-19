'use client'

import { useSession } from 'next-auth/react'
import { User } from '@/hooks/useUsers'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface DeleteUserModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  user: User | null
  loading: boolean
  error: string | null
}

export default function DeleteUserModal({
  isOpen,
  onClose,
  onConfirm,
  user,
  loading,
  error,
}: DeleteUserModalProps) {
  const { data: session } = useSession()

  if (!user) return null

  // Verificar si es el último administrador
  const isLastAdmin = user.role === 'ADMINISTRADOR'

  // Verificar si intenta eliminarse a sí mismo
  const isSelfDelete = session?.user?.id === user.id

  const handleConfirm = async () => {
    if (isLastAdmin || isSelfDelete) {
      return // No permitir la eliminación
    }

    await onConfirm()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Eliminar Usuario"
      size="sm"
    >
      <div className="space-y-6">
        {/* Información del usuario */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Usuario a eliminar:</h3>
          <div className="space-y-1 text-sm">
            <p><strong>Nombre:</strong> {user.name || 'Sin nombre'}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Rol:</strong> {user.role}</p>
          </div>
        </div>

        {/* Advertencias */}
        {(isLastAdmin || isSelfDelete) && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  No se puede eliminar este usuario
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {isLastAdmin && (
                    <p>Este es el último administrador del sistema. Debe haber al menos un administrador.</p>
                  )}
                  {isSelfDelete && (
                    <p>No puedes eliminar tu propia cuenta de usuario.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación */}
        {!isLastAdmin && !isSelfDelete && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  ¿Estás seguro?
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta del usuario{' '}
                    <strong>{user.name || user.email}</strong> y toda su información asociada.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={loading || isLastAdmin || isSelfDelete}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Eliminando...
              </>
            ) : (
              'Eliminar Usuario'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
