import { apiClient } from './client'
import { Store, StoreFormData, StoreFilters, StoreSort, StoreStatus, TemporaryModification, TemporaryModificationFormData } from '@/types/store'
import { buildStoreQueryParams } from '@/lib/utils/store'

export interface GetStoresParams {
  search?: string
  status?: StoreFilters['status']
  operator?: string
  surfaceMin?: number | null
  surfaceMax?: number | null
  vmmMin?: number | null
  vmmMax?: number | null
  dateFrom?: string | null
  dateTo?: string | null
  sort?: StoreSort
  expiringMonths?: number
}

export interface GetStoreOptions {
  applyModifications?: boolean
}

/**
 * Servicio para operaciones de tiendas
 */
export const storesService = {
  /**
   * Obtener lista única de operadores de centro comercial
   */
  async getOperators(): Promise<string[]> {
    return apiClient.get<string[]>('/api/stores/operators')
  },

  /**
   * Obtener todas las tiendas con filtros opcionales
   */
  async getAll(params?: GetStoresParams): Promise<Store[]> {
    const queryParams = new URLSearchParams()

    if (params) {
      // Construir filtros con valores por defecto
      const filters: StoreFilters = {
        search: params.search || '',
        status: params.status || StoreStatus.ACTIVE,
        operator: params.operator || '',
        surfaceMin: params.surfaceMin ?? null,
        surfaceMax: params.surfaceMax ?? null,
        vmmMin: params.vmmMin ?? null,
        vmmMax: params.vmmMax ?? null,
        dateFrom: params.dateFrom || null,
        dateTo: params.dateTo || null,
      }

      const sort = params.sort || { field: null, order: 'asc' }
      const builtParams = buildStoreQueryParams(filters, sort)
      
      // Copiar parámetros construidos
      builtParams.forEach((value, key) => {
        queryParams.append(key, value)
      })

      if (params.expiringMonths) {
        queryParams.append('expiringMonths', params.expiringMonths.toString())
      }
    }

    const queryString = queryParams.toString()
    const endpoint = queryString ? `/api/stores?${queryString}` : '/api/stores'
    
    return apiClient.get<Store[]>(endpoint)
  },

  /**
   * Obtener una tienda por ID
   */
  async getById(id: string, options?: GetStoreOptions): Promise<Store> {
    const query =
      options?.applyModifications === false ? '?applyModifications=false' : ''
    return apiClient.get<Store>(`/api/stores/${id}${query}`)
  },

  /**
   * Crear una nueva tienda
   */
  async create(data: StoreFormData): Promise<Store> {
    return apiClient.post<Store>('/api/stores', data)
  },

  /**
   * Actualizar una tienda existente
   */
  async update(id: string, data: Partial<StoreFormData>): Promise<Store> {
    return apiClient.put<Store>(`/api/stores/${id}`, data)
  },

  /**
   * Terminar una tienda (cambiar estado a TERMINATED)
   */
  async terminate(id: string): Promise<Store> {
    return apiClient.put<Store>(`/api/stores/${id}`, { status: 'TERMINATED' })
  },

  /**
   * Obtener todas las modificaciones temporales de una tienda
   */
  async getModifications(storeId: string): Promise<TemporaryModification[]> {
    return apiClient.get<TemporaryModification[]>(`/api/stores/${storeId}/modifications`)
  },

  /**
   * Crear una nueva modificación temporal
   */
  async createModification(storeId: string, data: TemporaryModificationFormData): Promise<TemporaryModification> {
    return apiClient.post<TemporaryModification>(`/api/stores/${storeId}/modifications`, data)
  },

  /**
   * Eliminar una modificación temporal
   */
  async deleteModification(storeId: string, modificationId: string): Promise<void> {
    await apiClient.delete(`/api/stores/${storeId}/modifications/${modificationId}`)
  },
}
