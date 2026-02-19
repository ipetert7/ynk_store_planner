'use client'

import { useEffect } from 'react'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card>
        <CardContent className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Algo salió mal
          </h2>
          <p className="text-gray-600 mb-6">
            Ocurrió un error inesperado. Por favor, intenta nuevamente.
          </p>
          {error.message && (
            <p className="text-sm text-red-600 mb-6 bg-red-50 p-3 rounded">
              {error.message}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <Button
              onClick={reset}
              variant="primary"
            >
              Intentar de nuevo
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
              variant="secondary"
            >
              Volver al inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

