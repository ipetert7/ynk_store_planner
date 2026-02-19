'use client'

import { useState } from 'react'
import { TemporaryModification } from '@/types/store'
import { isModificationActive } from '@/lib/utils/store'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { formatNumber } from '@/lib/utils/format'

interface TemporaryModificationListProps {
  modifications: TemporaryModification[]
  onDelete: (modificationId: string) => Promise<void>
  storeId: string
}

export default function TemporaryModificationList({
  modifications,
  onDelete,
  storeId,
}: TemporaryModificationListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const today = new Date()

  const getModificationStatus = (modification: TemporaryModification) => {
    if (isModificationActive(modification, today)) {
      return { label: 'Activa', variant: 'success' as const }
    }
    const endDate = new Date(modification.endDate)
    if (endDate < today) {
      return { label: 'Expirada', variant: 'default' as const }
    }
    return { label: 'Futura', variant: 'default' as const }
  }

  const handleDelete = async (modificationId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta modificación?')) {
      return
    }

    setDeletingId(modificationId)
    try {
      await onDelete(modificationId)
    } catch (error) {
      console.error('Error deleting modification:', error)
      alert('Error al eliminar la modificación')
    } finally {
      setDeletingId(null)
    }
  }

  if (modifications.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-gray-500 text-center">
            No hay modificaciones temporales registradas
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {modifications.map((modification) => {
        const status = getModificationStatus(modification)
        const isActive = isModificationActive(modification, today)
        const isFuture = new Date(modification.startDate) > today

        return (
          <Card key={modification.id} className={isActive ? 'border-indigo-300 bg-indigo-50/30' : ''}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge variant={status.variant} size="sm">
                    {status.label}
                  </Badge>
                  {isActive && (
                    <span className="text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-1 rounded">
                      Aplicándose actualmente
                    </span>
                  )}
                </div>
                {isFuture && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(modification.id)}
                    isLoading={deletingId === modification.id}
                  >
                    Eliminar
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Período</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(modification.startDate)} - {formatDate(modification.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Creada</p>
                  <p className="text-sm text-gray-700">
                    {formatDate(modification.createdAt)}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Valores Modificados
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">VMM</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatNumber(modification.minimumMonthlyRent)} UF$
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Original: {formatNumber(modification.originalMinimumMonthlyRent)} UF$
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Porcentaje</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatNumber(modification.percentageRent)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Original: {formatNumber(modification.originalPercentageRent)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Factor Diciembre</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatNumber(modification.decemberFactor)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Original: {formatNumber(modification.originalDecemberFactor)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

