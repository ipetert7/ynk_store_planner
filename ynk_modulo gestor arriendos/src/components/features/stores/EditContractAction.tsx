'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { canManageStores } from '@/lib/utils/permissions'

interface EditContractActionProps {
  storeId: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  onTemporary?: () => void
  onPermanent?: () => void
}

export default function EditContractAction({
  storeId,
  children,
  variant = 'secondary',
  size = 'md',
  className,
  disabled,
  onTemporary,
  onPermanent,
}: EditContractActionProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  // Verificar permisos - solo GESTOR o ADMINISTRADOR pueden editar
  const hasPermission = canManageStores(session?.user?.role as any)

  const handleOpen = () => {
    if (disabled || !hasPermission) return
    setIsOpen(true)
  }

  const handleClose = () => setIsOpen(false)

  const handlePermanent = () => {
    setIsOpen(false)
    if (onPermanent) {
      onPermanent()
      return
    }
    router.push(`/stores/${storeId}/edit`)
  }

  const handleTemporary = () => {
    setIsOpen(false)
    if (onTemporary) {
      onTemporary()
      return
    }
    router.push(`/stores/${storeId}?edit=temporary`)
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpen}
        disabled={disabled || !hasPermission}
        title={!hasPermission ? 'No tienes permisos para editar tiendas' : undefined}
      >
        {children}
      </Button>
      <Modal isOpen={isOpen} onClose={handleClose} title="Editar contrato" size="lg">
        <p className="text-sm text-gray-600">
          Elige si quieres un cambio permanente o una modificación temporal.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={handlePermanent}
            className="rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v16h16" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15l4-4 2 2 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Permanente</p>
                <p className="text-xs text-gray-500">Actualiza los valores base del contrato.</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Recomendado para cambios definitivos.
            </p>
          </button>
          <button
            type="button"
            onClick={handleTemporary}
            className="rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Temporal</p>
                <p className="text-xs text-gray-500">Aplica cambios por un período.</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Se revierte automáticamente al finalizar.
            </p>
          </button>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
        </div>
      </Modal>
    </>
  )
}
