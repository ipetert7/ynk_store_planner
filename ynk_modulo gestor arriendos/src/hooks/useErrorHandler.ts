import { useCallback } from 'react'
import { ApiClientError } from '@/lib/api/client'

export interface UseErrorHandlerReturn {
  handleError: (error: unknown) => string
  getErrorMessage: (error: unknown) => string
}

/**
 * Hook para manejo centralizado de errores
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const getErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof ApiClientError) {
      return error.message
    }

    if (error instanceof Error) {
      return error.message
    }

    if (typeof error === 'string') {
      return error
    }

    return 'Ocurrió un error inesperado'
  }, [])

  const handleError = useCallback(
    (error: unknown): string => {
      const message = getErrorMessage(error)

      // Log error in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error handled:', error)
      }

      // TODO: Send to error reporting service in production
      // Example: logErrorToService(error)

      return message
    },
    [getErrorMessage]
  )

  return {
    handleError,
    getErrorMessage,
  }
}

