import { apiClient } from './client'

export interface UFValue {
  date: string
  value: number
  updatedAt: string
}

export interface UFHistoryResponse {
  data: Array<{
    date: string
    value: number
  }>
  count: number
}

/**
 * Servicio para operaciones de UF
 */
export const ufService = {
  /**
   * Obtener valor de UF del día actual o de una fecha específica
   * @param date - Fecha opcional en formato YYYY-MM-DD
   */
  async getValue(date?: string): Promise<UFValue> {
    const params = date ? `?date=${date}` : ''
    return apiClient.get<UFValue>(`/api/uf${params}`)
  },

  /**
   * Obtener historial de UF de los últimos N días
   * @param days - Número de días (máximo 365)
   */
  async getHistory(days: number = 365): Promise<UFHistoryResponse> {
    const clampedDays = Math.min(Math.max(1, days), 365)
    return apiClient.get<UFHistoryResponse>(`/api/uf?range=${clampedDays}`)
  },

  /**
   * Forzar actualización del valor de UF
   * @param date - Fecha opcional en formato YYYY-MM-DD
   */
  async updateValue(date?: string): Promise<UFValue> {
    return apiClient.post<UFValue>('/api/uf', { date })
  },

  /**
   * Precargar valores históricos faltantes para un rango (completo)
   * @param days - Número de días (máximo 365)
   */
  async preloadHistory(days: number = 365): Promise<{
    success: boolean
    loaded: number
    errors: number
    remaining: number
    total: number
  }> {
    const clampedDays = Math.min(Math.max(1, days), 365)
    return apiClient.put<{
      success: boolean
      loaded: number
      errors: number
      remaining: number
      total: number
    }>('/api/uf', { range: clampedDays })
  },

  /**
   * Precargar valores históricos faltantes en batches para progreso preciso
   * @param days - Número de días (máximo 365)
   * @param batchSize - Tamaño del batch a procesar (default: 10)
   * @param startFrom - Índice desde donde empezar (default: 0)
   */
  async preloadHistoryBatch(days: number = 365, batchSize: number = 10, startFrom: number = 0): Promise<{
    success: boolean
    loaded: number
    errors: number
    remaining: number
    total: number
    progress: number
    completed: boolean
    nextStartFrom: number
  }> {
    const clampedDays = Math.min(Math.max(1, days), 365)
    const clampedBatchSize = Math.min(Math.max(1, batchSize), 50) // Máximo 50 por batch

    return apiClient.put<{
      success: boolean
      loaded: number
      errors: number
      remaining: number
      total: number
      progress: number
      completed: boolean
      nextStartFrom: number
    }>('/api/uf', {
      range: clampedDays,
      batchSize: clampedBatchSize,
      startFrom
    })
  },

  /**
   * Borrar y resincronizar completamente los valores históricos de UF
   * @param days - Número de días (máximo 365)
   */
  async resyncHistory(days: number = 365): Promise<{
    success: boolean
    deleted: number
    loaded: number
    errors: number
  }> {
    const clampedDays = Math.min(Math.max(1, days), 365)
    return apiClient.delete<{
      success: boolean
      deleted: number
      loaded: number
      errors: number
    }>(`/api/uf?range=${clampedDays}`)
  },
}

