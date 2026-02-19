'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Store } from '@/types/store'
import {
  calculateDaysUntil,
  getNotificationDate,
  formatDate,
  getAlertColor,
} from '@/lib/utils'
import { formatNumber } from '@/lib/utils/format'
import Modal from '@/components/ui/Modal'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EditContractAction from '@/components/features/stores/EditContractAction'
import { resolveApiPath } from '@/lib/api/paths'

interface StoreModalProps {
  isOpen: boolean
  onClose: () => void
  storeId: string | null
  onStoreUpdated?: () => void
}

export default function StoreModal({
  isOpen,
  onClose,
  storeId,
  onStoreUpdated,
}: StoreModalProps) {
  const router = useRouter()
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(false)

  // Calcular superficie de bodega cuando se tenga la tienda
  const surfaceAreaWarehouse = useMemo(() => {
    return store ? store.surfaceAreaTotal - store.surfaceAreaHall : 0
  }, [store])

  useEffect(() => {
    if (isOpen && storeId) {
      fetchStore()
    } else {
      setStore(null)
    }
  }, [isOpen, storeId])

  const fetchStore = async () => {
    if (!storeId) return

    setLoading(true)
    try {
      const response = await fetch(resolveApiPath(`/api/stores/${storeId}`))
      if (response.ok) {
        const data = await response.json()
        // Convertir fechas de string a Date
        data.contractStartDate = new Date(data.contractStartDate)
        data.contractEndDate = new Date(data.contractEndDate)
        data.createdAt = new Date(data.createdAt)
        data.updatedAt = new Date(data.updatedAt)
        setStore(data)
      } else {
        setStore(null)
      }
    } catch (error) {
      console.error('Error fetching store:', error)
      setStore(null)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = () => {
    if (storeId) {
      router.push(`/stores/${storeId}`)
      onClose()
    }
  }

  if (!storeId) return null

  const daysUntilEnd = store ? calculateDaysUntil(store.contractEndDate) : 0
  const notificationDate = store ? getNotificationDate(store) : new Date()
  const daysUntilNotification = store
    ? calculateDaysUntil(notificationDate)
    : 0
  const alertColor = store ? getAlertColor(daysUntilEnd) : ''
  const isExpiringSoon =
    store && daysUntilEnd <= 180 && store.status === 'ACTIVE'
  const isNotificationDue =
    store &&
    daysUntilNotification <= store.notificationPeriodDays &&
    store.status === 'ACTIVE'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={store ? store.storeName : 'Cargando...'}
      size="xl"
    >
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" text="Cargando información de la tienda..." />
        </div>
      ) : !store ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Tienda no encontrada</p>
        </div>
      ) : (
        <div className="space-y-5 -mt-2">
          {/* Header compacto */}
          <div className="space-y-2">
            {/* Banner, Badge e ID ERP en la misma línea */}
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-base text-gray-600">{store.banner}</p>
              <Badge
                variant={store.status === 'ACTIVE' ? 'success' : 'default'}
                size="sm"
              >
                {store.status === 'ACTIVE' ? 'Activo' : 'Terminado'}
              </Badge>
              {store.erpId && (
                <span className="text-sm text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded-md">
                  ID ERP: {store.erpId}
                </span>
              )}
            </div>

            {/* Alert Banner */}
            {isExpiringSoon && (
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md">
                <p className="font-semibold text-yellow-900 mb-1">
                  Contrato próximo a vencer
                </p>
                <p className="text-sm text-yellow-800">
                  El contrato vence en <strong>{daysUntilEnd} días</strong> (
                  {formatDate(store.contractEndDate)})
                </p>
              </div>
            )}
          </div>

          {/* Information Cards - Vista Rápida */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900">
                  Información del Contrato
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {store.erpId && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">ID ERP:</span>
                      <span className="font-semibold text-blue-600 text-right">
                        {store.erpId}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Operador:</span>
                    <span className="font-semibold text-gray-900 text-right">
                      {store.shoppingCenterOperator || 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Superficie de Sala:</span>
                    <span className="font-semibold text-gray-900">
                      {formatNumber(store.surfaceAreaHall)} m²
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Superficie Total:</span>
                    <span className="font-semibold text-gray-900">
                      {formatNumber(store.surfaceAreaTotal)} m²
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Superficie de Bodega:</span>
                    <span className="font-semibold text-gray-900">
                      {formatNumber(surfaceAreaWarehouse)} m²
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Fecha Inicio:</span>
                    <span className="font-semibold text-gray-900">
                      {formatDate(store.contractStartDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Fecha Término:</span>
                    <span className={`font-semibold ${alertColor}`}>
                      {formatDate(store.contractEndDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Duración:</span>
                    <span className="font-semibold text-gray-900">
                      {store.contractDuration} meses
                    </span>
                  </div>

                  {store.status === 'ACTIVE' && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600">Días restantes:</span>
                      <span className={`font-bold text-lg ${alertColor}`}>
                        {daysUntilEnd > 0 ? `${daysUntilEnd} días` : 'Vencido'}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900">
                  Información Financiera
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">VMM (UF$):</span>
                    <span className="font-semibold text-gray-900">
                      {formatNumber(store.minimumMonthlyRent)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Porcentual:</span>
                    <span className="font-semibold text-gray-900">
                      {formatNumber(store.percentageRent)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Factor Diciembre:</span>
                    <span className="font-semibold text-gray-900">
                      {formatNumber(store.decemberFactor)}x
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Gastos Comunes:</span>
                    <span className="font-semibold text-gray-900">
                      {formatNumber(store.commonExpenses)} UF$/m²
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Fondo de Promoción:</span>
                    <span className="font-semibold text-gray-900">
                      {formatNumber(store.promotionFund)}% del VMM
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">
                      Período Notificación:
                    </span>
                    <span className="font-semibold text-gray-900">
                      {store.notificationPeriodDays} días
                    </span>
                  </div>

                  {store.status === 'ACTIVE' && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600">
                        Fecha Notificación:
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatDate(notificationDate)}
                      </span>
                    </div>
                  )}
                </div>

                {isNotificationDue && (
                  <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md">
                    <p className="text-sm font-medium text-yellow-800">
                      Próximo al plazo de notificación ({daysUntilNotification}{' '}
                      días)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
            <Button
              variant="primary"
              onClick={handleViewDetail}
              className="flex-1"
            >
              Ver Detalle Completo
            </Button>
            {store.status === 'ACTIVE' && (
              <EditContractAction
                storeId={store.id}
                variant="secondary"
                className="flex-1 w-full"
                onPermanent={() => {
                  onClose()
                  router.push(`/stores/${store.id}/edit`)
                }}
                onTemporary={() => {
                  onClose()
                  router.push(`/stores/${store.id}?edit=temporary`)
                }}
              >
                Editar Contrato
              </EditContractAction>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
