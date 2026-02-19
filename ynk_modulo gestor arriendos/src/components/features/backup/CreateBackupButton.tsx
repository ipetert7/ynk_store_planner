'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

interface CreateBackupButtonProps {
  onCreateBackup: () => Promise<any>
  isLoading?: boolean
  disabled?: boolean
}

export default function CreateBackupButton({
  onCreateBackup,
  isLoading: externalLoading = false,
  disabled = false
}: CreateBackupButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isLoading = externalLoading || internalLoading

  const handleCreateBackup = async () => {
    setInternalLoading(true)
    setSuccessMessage(null)

    try {
      const result = await onCreateBackup()

      if (result?.success) {
        setSuccessMessage('Backup creado exitosamente')
        // Ocultar mensaje después de 3 segundos
        setTimeout(() => setSuccessMessage(null), 3000)
      }
    } catch (error) {
      // El error se maneja en el componente padre
      console.error('Error creando backup:', error)
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={handleCreateBackup}
        isLoading={isLoading}
        disabled={disabled || isLoading}
        variant="primary"
        size="lg"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        {isLoading ? 'Creando backup...' : 'Crear Backup'}
      </Button>

      {successMessage && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
