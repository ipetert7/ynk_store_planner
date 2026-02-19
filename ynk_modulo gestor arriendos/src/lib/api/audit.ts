import { apiClient } from './client'
import { AuditLog } from '@/types/store'

export interface GetAuditLogsParams {
  storeId?: string
}

/**
 * Servicio para operaciones de auditoría
 */
export const auditService = {
  /**
   * Obtener logs de auditoría
   */
  async getLogs(params?: GetAuditLogsParams): Promise<AuditLog[]> {
    const queryParams = new URLSearchParams()
    if (params?.storeId) {
      queryParams.append('storeId', params.storeId)
    }

    const queryString = queryParams.toString()
    const endpoint = queryString ? `/api/audit?${queryString}` : '/api/audit'
    
    return apiClient.get<AuditLog[]>(endpoint)
  },
}

