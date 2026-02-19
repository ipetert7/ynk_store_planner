'use client'

import { useEffect, useState } from 'react'
import { AuditLog as AuditLogType, AuditAction } from '@/types/store'
import { formatDate } from '@/lib/utils'
import { resolveApiPath } from '@/lib/api/paths'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Card, CardContent } from '@/components/ui/Card'

interface AuditLogProps {
  storeId: string
}

export default function AuditLog({ storeId }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [storeId])

  const fetchLogs = async () => {
    try {
      const response = await fetch(resolveApiPath(`/api/audit?storeId=${encodeURIComponent(storeId)}`))
      if (response.ok) {
        const data = await response.json()
        setLogs(data)
      } else {
        console.error('Error fetching audit logs:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionLabel = (action: AuditAction) => {
    switch (action) {
      case AuditAction.CREATE:
        return 'Creación'
      case AuditAction.UPDATE:
        return 'Actualización'
      case AuditAction.TERMINATE:
        return 'Cierre'
      case AuditAction.CREATE_TEMPORARY_MODIFICATION:
        return 'Modificación temporal creada'
      case AuditAction.DELETE_TEMPORARY_MODIFICATION:
        return 'Modificación temporal eliminada'
      case AuditAction.EXPIRE_TEMPORARY_MODIFICATION:
        return 'Modificación temporal expirada'
      default:
        return action
    }
  }


  const getActionVariant = (action: AuditAction): 'success' | 'info' | 'danger' | 'default' => {
    switch (action) {
      case AuditAction.CREATE:
        return 'success'
      case AuditAction.UPDATE:
        return 'info'
      case AuditAction.TERMINATE:
        return 'danger'
      case AuditAction.CREATE_TEMPORARY_MODIFICATION:
        return 'info'
      case AuditAction.DELETE_TEMPORARY_MODIFICATION:
        return 'danger'
      case AuditAction.EXPIRE_TEMPORARY_MODIFICATION:
        return 'default'
      default:
        return 'default'
    }
  }

  // Verificar si un campo es una fecha
  const isDateField = (fieldName: string | null | undefined): boolean => {
    if (!fieldName) return false
    return fieldName.toLowerCase().includes('date') || fieldName.toLowerCase().includes('fecha')
  }

  // Formatear un valor según su tipo
  const formatValue = (value: string | null | undefined, fieldName: string | null | undefined): string => {
    if (!value) return ''
    if (isDateField(fieldName)) {
      // Intentar parsear como fecha ISO
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return formatDate(date)
      }
    }
    return value
  }

  if (loading) {
    return (
      <div className="py-8">
        <LoadingSpinner text="Cargando historial..." />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">
          No hay registros de auditoría para esta tienda
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-1">
          Historial de Cambios
        </h3>
        <p className="text-sm text-gray-600">
          Registro completo de todas las modificaciones realizadas
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-8">
          {logs.map((log, index) => (
            <div key={log.id} className="relative flex gap-4">
              {/* Timeline Dot */}
              <div className="flex-shrink-0 relative z-10">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center">
                </div>
              </div>

              {/* Content Card */}
              <div className="flex-1 min-w-0 pb-6">
                <Card hover>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getActionVariant(log.action)} size="sm">
                          {getActionLabel(log.action)}
                        </Badge>
                        {log.fieldChanged && (
                          <span className="text-sm text-gray-600">
                            Campo: <strong className="text-gray-900">{log.fieldChanged}</strong>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>

                    {log.user && (
                      <div className="mb-3 pb-3 border-b border-gray-100">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">{log.user.name}</span>
                          <span className="text-gray-500"> ({log.user.email})</span>
                        </p>
                      </div>
                    )}

                    {log.fieldChanged && (log.oldValue || log.newValue) && (
                      <div className="space-y-2">
                        {log.oldValue && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 mt-0.5">Antes:</span>
                            <div className="flex-1 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                              <span className="text-sm text-red-800 line-through">
                                {formatValue(log.oldValue, log.fieldChanged)}
                              </span>
                            </div>
                          </div>
                        )}
                        {log.newValue && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 mt-0.5">Después:</span>
                            <div className="flex-1 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                              <span className="text-sm font-medium text-green-800">
                                {formatValue(log.newValue, log.fieldChanged)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
