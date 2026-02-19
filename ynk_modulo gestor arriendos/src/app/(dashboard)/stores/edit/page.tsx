'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { StoreFilters, StoreStatus } from '@/types/store'
import { useStores } from '@/hooks/useStores'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatDate, calculateDaysUntil, getAlertColor } from '@/lib/utils'
import { formatNumber } from '@/lib/utils/format'
import EditContractAction from '@/components/features/stores/EditContractAction'

const ACTIVE_STORES_FILTERS: StoreFilters = {
  search: '',
  status: StoreStatus.ACTIVE,
  operator: '',
  surfaceMin: null,
  surfaceMax: null,
  vmmMin: null,
  vmmMax: null,
  dateFrom: null,
  dateTo: null,
}

export default function EditStorePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  
  // Obtener solo tiendas activas
  const { stores, loading, error } = useStores({
    filters: ACTIVE_STORES_FILTERS,
    autoFetch: !!session,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Filtrar tiendas por búsqueda
  const filteredStores = stores.filter((store) => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    return (
      store.storeName.toLowerCase().includes(query) ||
      store.banner.toLowerCase().includes(query) ||
      (store.shoppingCenterOperator?.toLowerCase().includes(query) ?? false)
    )
  })

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Cargando tiendas..." />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error al cargar tiendas
          </h2>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <Button variant="primary" onClick={() => router.push('/')}>
            Volver al inicio
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Modificar Tienda
        </h1>
        <p className="text-gray-600">
          Selecciona la tienda que deseas modificar
        </p>
      </div>

      {/* Search Section */}
      <Card>
        <CardContent className="p-6">
          <Input
            label="Buscar tienda"
            placeholder="Buscar por nombre, banner u operador..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </CardContent>
      </Card>

      {/* Stores List */}
      {filteredStores.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {searchQuery ? 'No se encontraron tiendas' : 'No hay tiendas activas'}
            </h3>
            <p className="text-gray-600 mb-8 text-base">
              {searchQuery
                ? 'Intenta ajustar tu búsqueda para encontrar la tienda que buscas.'
                : 'No hay tiendas activas disponibles para modificar.'}
            </p>
            {searchQuery && (
              <Button variant="secondary" onClick={() => setSearchQuery('')}>
                Limpiar búsqueda
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => {
            const daysUntilEnd = calculateDaysUntil(store.contractEndDate)
            const alertColor = getAlertColor(daysUntilEnd)
            
            return (
              <Card key={store.id} hover>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                        {store.storeName}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">
                        {store.banner}
                      </p>
                    </div>
                    <Badge
                      variant="success"
                      size="sm"
                      className="ml-2 flex-shrink-0"
                    >
                      Activo
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Operador:</span>
                      <span className="text-sm font-medium text-gray-900 text-right">
                        {store.shoppingCenterOperator || 'N/A'}
                      </span>
                    </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Superficie Total:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatNumber(store.surfaceAreaTotal)} m²
                        </span>
                      </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                      <span className="text-sm text-gray-600">VMM:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatNumber(store.minimumMonthlyRent)} UF$
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-sm text-gray-600">Fecha Término:</span>
                      <span className={`text-sm font-medium ${alertColor}`}>
                        {formatDate(store.contractEndDate)}
                      </span>
                    </div>
                  </div>

                  <EditContractAction
                    storeId={store.id}
                    variant="primary"
                    size="md"
                    className="w-full"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </EditContractAction>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
