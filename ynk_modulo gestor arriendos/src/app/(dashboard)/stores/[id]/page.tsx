'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Store, TemporaryModification, TemporaryModificationFormData } from '@/types/store'
import {
  calculateDaysUntil,
  getNotificationDate,
  formatDate,
  getAlertColor,
} from '@/lib/utils'
import { formatNumber } from '@/lib/utils/format'
import { storesService } from '@/lib/api/stores'
import AuditLog from '@/components/features/audit/AuditLog'
import TemporaryModificationForm from '@/components/features/stores/TemporaryModificationForm'
import TemporaryModificationList from '@/components/features/stores/TemporaryModificationList'
import EditContractAction from '@/components/features/stores/EditContractAction'
import PermanentModificationForm, { PermanentModificationFormData } from '@/components/features/stores/PermanentModificationForm'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import { resolveApiPath } from '@/lib/api/paths'

const formatLocalDateToInput = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function StoreDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [terminating, setTerminating] = useState(false)
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [modifications, setModifications] = useState<TemporaryModification[]>([])
  const [loadingModifications, setLoadingModifications] = useState(false)
  const [showTemporaryModal, setShowTemporaryModal] = useState(false)
  const [showPermanentModal, setShowPermanentModal] = useState(false)
  const hasConsumedEditMode = useRef(false)
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)

  // Calcular superficie de bodega
  const surfaceAreaWarehouse = useMemo(() => {
    return store ? store.surfaceAreaTotal - store.surfaceAreaHall : 0
  }, [store])

  const temporaryInitialValues = useMemo<Partial<TemporaryModificationFormData> | undefined>(() => {
    if (!store) return undefined

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const contractStart = new Date(store.contractStartDate)
    contractStart.setHours(0, 0, 0, 0)

    const contractEnd = new Date(store.contractEndDate)
    contractEnd.setHours(0, 0, 0, 0)

    let startDate = today
    if (today < contractStart || today >= contractEnd) {
      startDate = contractStart
    }

    return {
      startDate: formatLocalDateToInput(startDate),
      endDate: '',
      minimumMonthlyRent: store.minimumMonthlyRent,
      percentageRent: store.percentageRent,
      decemberFactor: store.decemberFactor,
    }
  }, [store])

  useEffect(() => {
    fetchStore()
    fetchModifications()
  }, [params.id])

  const openTemporaryModification = () => {
    if (store?.status !== 'ACTIVE') return
    setShowTemporaryModal(true)
  }

  useEffect(() => {
    const editMode = searchParams.get('edit')
    if (
      editMode === 'temporary' &&
      store?.status === 'ACTIVE' &&
      !hasConsumedEditMode.current
    ) {
      hasConsumedEditMode.current = true
      openTemporaryModification()
      router.replace(`/stores/${params.id}`)
    }
  }, [searchParams, store?.status, router, params.id])

  const fetchStore = async () => {
    try {
      const response = await fetch(resolveApiPath(`/api/stores/${params.id}`))
      if (response.ok) {
        const data = await response.json()
        // Convertir fechas de string a Date
        data.contractStartDate = new Date(data.contractStartDate)
        data.contractEndDate = new Date(data.contractEndDate)
        data.createdAt = new Date(data.createdAt)
        data.updatedAt = new Date(data.updatedAt)
        if (data.activeModification) {
          data.activeModification.startDate = new Date(data.activeModification.startDate)
          data.activeModification.endDate = new Date(data.activeModification.endDate)
          data.activeModification.createdAt = new Date(data.activeModification.createdAt)
          data.activeModification.updatedAt = new Date(data.activeModification.updatedAt)
        }
        setStore(data)
      } else if (response.status === 404) {
        router.push('/')
      }
    } catch (error) {
      console.error('Error fetching store:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchModifications = async () => {
    if (!params.id) return
    try {
      setLoadingModifications(true)
      const data = await storesService.getModifications(params.id as string)
      // Convertir fechas de string a Date
      const modificationsWithDates = data.map((mod) => ({
        ...mod,
        startDate: new Date(mod.startDate),
        endDate: new Date(mod.endDate),
        createdAt: new Date(mod.createdAt),
        updatedAt: new Date(mod.updatedAt),
      }))
      setModifications(modificationsWithDates)
    } catch (error) {
      console.error('Error fetching modifications:', error)
    } finally {
      setLoadingModifications(false)
    }
  }

  const handleCreateModification = async (data: TemporaryModificationFormData) => {
    if (!params.id) return
    await storesService.createModification(params.id as string, data)
    setShowTemporaryModal(false)
    await fetchModifications()
    await fetchStore() // Refresh store to get active modification
    setAuditRefreshKey((prev) => prev + 1)
  }

  const handlePermanentUpdate = async (data: PermanentModificationFormData) => {
    if (!params.id) return
    await storesService.update(params.id as string, data)
    setShowPermanentModal(false)
    await fetchStore()
    setAuditRefreshKey((prev) => prev + 1)
  }

  const handleDeleteModification = async (modificationId: string) => {
    if (!params.id) return
    await storesService.deleteModification(params.id as string, modificationId)
    await fetchModifications()
    await fetchStore() // Refresh store to update active modification
    setAuditRefreshKey((prev) => prev + 1)
  }

  const handleTerminate = async () => {
    if (store?.status === 'TERMINATED') {
      alert('El contrato ya está cerrado')
      setShowTerminateModal(false)
      return
    }

    try {
      setTerminating(true)
      setShowTerminateModal(false)
      const response = await fetch(resolveApiPath(`/api/stores/${params.id}`), {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/')
        router.refresh()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Error al cerrar el contrato')
      }
    } catch (error) {
      console.error('Error terminating store:', error)
      alert('Error al cerrar el contrato')
    } finally {
      setTerminating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Cargando información de la tienda..." />
      </div>
    )
  }

  if (!store) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Tienda no encontrada
          </h2>
          <p className="text-gray-600 mb-6">
            La tienda que buscas no existe o ha sido eliminada.
          </p>
          <Button variant="primary" onClick={() => router.push('/')}>
            Volver al inicio
          </Button>
        </CardContent>
      </Card>
    )
  }

  const daysUntilEnd = calculateDaysUntil(store.contractEndDate)
  const notificationDate = getNotificationDate(store)
  const daysUntilNotification = calculateDaysUntil(notificationDate)
  const alertColor = getAlertColor(daysUntilEnd)
  const isExpiringSoon = daysUntilEnd <= 180 && store.status === 'ACTIVE'
  const isNotificationDue = daysUntilNotification <= store.notificationPeriodDays && store.status === 'ACTIVE'

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {store.storeName}
              </h1>
              <Badge 
                variant={store.status === 'ACTIVE' ? 'success' : 'default'}
                size="lg"
              >
                {store.status === 'ACTIVE' ? 'Activo' : 'Terminado'}
              </Badge>
            </div>
            <p className="text-lg text-gray-600">
              {store.banner}
            </p>
            <p className="text-sm text-blue-600 font-medium">
              ID ERP: {store.erpId}
            </p>
          </div>
          
          {store.status === 'ACTIVE' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <EditContractAction
                storeId={store.id}
                variant="primary"
                size="lg"
                className="whitespace-nowrap"
                onTemporary={openTemporaryModification}
                onPermanent={() => setShowPermanentModal(true)}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar Contrato
              </EditContractAction>
              <Button
                variant="danger"
                size="lg"
                onClick={() => setShowTerminateModal(true)}
                className="whitespace-nowrap"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cerrar Contrato
              </Button>
            </div>
          )}
        </div>

        {/* Alert Banner */}
        {isExpiringSoon && (
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md">
            <p className="font-semibold text-yellow-900 mb-1">
              Contrato próximo a vencer
            </p>
            <p className="text-sm text-yellow-800">
              El contrato vence en <strong>{daysUntilEnd} días</strong> ({formatDate(store.contractEndDate)})
            </p>
          </div>
        )}
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">
              Información del Contrato
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Operador:
                </span>
                <span className="font-semibold text-gray-900 text-right">
                  {store.shoppingCenterOperator || 'N/A'}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Superficie de Sala:
                </span>
                <span className="font-semibold text-gray-900">
                  {formatNumber(store.surfaceAreaHall)} m²
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Superficie Total:
                </span>
                <span className="font-semibold text-gray-900">
                  {formatNumber(store.surfaceAreaTotal)} m²
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Superficie de Bodega:
                </span>
                <span className="font-semibold text-gray-900">
                  {formatNumber(surfaceAreaWarehouse)} m²
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Fecha Inicio:
                </span>
                <span className="font-semibold text-gray-900">
                  {formatDate(store.contractStartDate)}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Fecha Término:
                </span>
                <span className={`font-semibold ${alertColor}`}>
                  {formatDate(store.contractEndDate)}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Duración:
                </span>
                <span className="font-semibold text-gray-900">
                  {store.contractDuration} meses
                </span>
              </div>
              
              {store.status === 'ACTIVE' && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-600">
                    Días restantes:
                  </span>
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
            <h2 className="text-xl font-semibold text-gray-900">
              Información Financiera
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {store.activeModification && (
                <div className="mb-4 p-3 bg-indigo-50 border-l-4 border-indigo-400 rounded-r-md">
                  <p className="text-xs font-semibold text-indigo-900 mb-1 uppercase tracking-wide">
                    Modificación Temporal Activa
                  </p>
                  <p className="text-xs text-indigo-700">
                    Válida hasta {formatDate(store.activeModification.endDate)}
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  VMM (UF$):
                </span>
                <span className={`font-semibold ${store.activeModification ? 'text-indigo-600' : 'text-gray-900'}`}>
                  {formatNumber(store.minimumMonthlyRent)}
                  {store.activeModification && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      (Original: {formatNumber(store.activeModification.originalMinimumMonthlyRent)})
                    </span>
                  )}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Porcentual:
                </span>
                <span className={`font-semibold ${store.activeModification ? 'text-indigo-600' : 'text-gray-900'}`}>
                  {formatNumber(store.percentageRent)}%
                  {store.activeModification && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      (Original: {formatNumber(store.activeModification.originalPercentageRent)}%)
                    </span>
                  )}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Factor Diciembre:
                </span>
                <span className={`font-semibold ${store.activeModification ? 'text-indigo-600' : 'text-gray-900'}`}>
                  {formatNumber(store.decemberFactor)}x
                  {store.activeModification && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      (Original: {formatNumber(store.activeModification.originalDecemberFactor)}x)
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Gastos Comunes:
                </span>
                <span className="font-semibold text-gray-900">
                  {formatNumber(store.commonExpenses)} UF$/m²
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Fondo de Promoción:
                </span>
                <span className="font-semibold text-gray-900">
                  {formatNumber(store.promotionFund)}% del VMM
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Período Notificación:
                </span>
                <span className="font-semibold text-gray-900">
                  {store.notificationPeriodDays} días
                </span>
              </div>
              
              {store.status === 'ACTIVE' && (
                <div className="flex items-center justify-between py-3">
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
                  Próximo al plazo de notificación ({daysUntilNotification} días)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Temporary Modifications Section */}
      {store.status === 'ACTIVE' && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">
              Modificaciones Temporales
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Gestiona modificaciones temporales a las condiciones financieras del contrato
            </p>
          </CardHeader>
          <CardContent>
            {loadingModifications ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <TemporaryModificationList
                modifications={modifications}
                onDelete={handleDeleteModification}
                storeId={store.id}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={showTerminateModal}
        onClose={() => setShowTerminateModal(false)}
        title="Cerrar contrato"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Al cerrar el contrato, este cambiará su estado a "Terminado" y no podrá
          ser editado. Esta acción no se puede revertir.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTerminateModal(false)}
            disabled={terminating}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleTerminate}
            isLoading={terminating}
            disabled={terminating}
          >
            Cerrar Contrato
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showPermanentModal}
        onClose={() => setShowPermanentModal(false)}
        title="Modificación permanente"
        size="lg"
      >
        <p className="text-sm text-gray-600 mb-4">
          Actualiza los valores base del contrato de forma definitiva.
        </p>
        <PermanentModificationForm
          store={store}
          onSubmit={handlePermanentUpdate}
          onCancel={() => setShowPermanentModal(false)}
        />
      </Modal>

      <Modal
        isOpen={showTemporaryModal}
        onClose={() => setShowTemporaryModal(false)}
        title="Modificación temporal"
        size="lg"
      >
        <p className="text-sm text-gray-600 mb-4">
          Aplica cambios por un período específico y se revertirán al finalizar.
        </p>
        <TemporaryModificationForm
          storeId={store.id}
          onSubmit={handleCreateModification}
          onCancel={() => setShowTemporaryModal(false)}
          initialValues={temporaryInitialValues}
          variant="plain"
          showHeader={false}
        />
      </Modal>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">
            Historial de Cambios
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Registro de todas las modificaciones realizadas en este contrato
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <AuditLog key={auditRefreshKey} storeId={store.id} />
        </CardContent>
      </Card>
    </div>
  )
}
