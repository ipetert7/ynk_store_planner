import { useState, useEffect, useCallback } from 'react'
import { ufService, UFValue } from '@/lib/api/uf'
import { useErrorHandler } from './useErrorHandler'

export interface UseUFReturn {
  uf: UFValue | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export interface UseUFOptions {
  date?: string
  autoFetch?: boolean
}

/**
 * Hook para obtener el valor de la UF
 */
export function useUF(options: UseUFOptions = {}): UseUFReturn {
  const { date, autoFetch = true } = options
  const [uf, setUf] = useState<UFValue | null>(null)
  const [loading, setLoading] = useState<boolean>(autoFetch)
  const [error, setError] = useState<string | null>(null)
  const { handleError } = useErrorHandler()

  const fetchUF = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await ufService.getValue(date)
      setUf(data)
    } catch (err) {
      const errorMessage = handleError(err)
      setError(errorMessage)
      setUf(null)
    } finally {
      setLoading(false)
    }
  }, [date, handleError])

  useEffect(() => {
    if (autoFetch) {
      fetchUF()
    }
  }, [autoFetch, fetchUF])

  return {
    uf,
    loading,
    error,
    refresh: fetchUF,
  }
}

