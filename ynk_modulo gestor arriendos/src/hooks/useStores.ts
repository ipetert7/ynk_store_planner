import { useState, useEffect, useCallback } from 'react'
import { Store, StoreFilters, StoreSort } from '@/types/store'
import { storesService, GetStoresParams } from '@/lib/api/stores'
import { useErrorHandler } from './useErrorHandler'

export interface UseStoresReturn {
  stores: Store[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export interface UseStoresOptions {
  filters?: StoreFilters
  sort?: StoreSort
  expiringMonths?: number
  autoFetch?: boolean
}

/**
 * Hook para obtener y gestionar tiendas
 */
export function useStores(options: UseStoresOptions = {}): UseStoresReturn {
  const { filters, sort, expiringMonths, autoFetch = true } = options
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState<boolean>(autoFetch)
  const [error, setError] = useState<string | null>(null)
  const { handleError } = useErrorHandler()

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params: GetStoresParams = {
        ...filters,
        sort,
        expiringMonths,
      }

      const data = await storesService.getAll(params)
      setStores(data)
    } catch (err) {
      const errorMessage = handleError(err)
      setError(errorMessage)
      setStores([])
    } finally {
      setLoading(false)
    }
  }, [filters, sort, expiringMonths, handleError])

  useEffect(() => {
    if (autoFetch) {
      fetchStores()
    }
  }, [autoFetch, fetchStores])

  return {
    stores,
    loading,
    error,
    refetch: fetchStores,
  }
}

