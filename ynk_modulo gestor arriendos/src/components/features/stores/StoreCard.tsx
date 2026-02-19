'use client'

import Link from 'next/link'
import { Store } from '@/types/store'
import { calculateDaysUntil, getAlertColor, formatDate } from '@/lib/utils'
import { formatNumber } from '@/lib/utils/format'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EditContractAction from '@/components/features/stores/EditContractAction'

interface StoreCardProps {
  store: Store
}

export default function StoreCard({ store }: StoreCardProps) {
  const daysUntilEnd = calculateDaysUntil(store.contractEndDate)

  // Calcular superficie de bodega
  const surfaceAreaWarehouse = store.surfaceAreaTotal - store.surfaceAreaHall
  const alertColor = getAlertColor(daysUntilEnd)
  const isExpiringSoon = daysUntilEnd <= 180 && store.status === 'ACTIVE'

  return (
    <Card hover className="h-full flex flex-col">
      <CardContent className="p-8 flex flex-col flex-1">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-900 mb-1 truncate">
              {store.storeName}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {store.banner}
            </p>
            <p className="text-xs text-blue-600 font-medium truncate">
              ID ERP: {store.erpId}
            </p>
          </div>
          <Badge 
            variant={store.status === 'ACTIVE' ? 'success' : 'default'}
            size="sm"
            className="ml-2 flex-shrink-0"
          >
            {store.status === 'ACTIVE' ? 'Activo' : 'Terminado'}
          </Badge>
        </div>

        {/* Alert Banner */}
        {isExpiringSoon && (
          <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md">
            <p className="text-sm font-medium text-yellow-800">
              Contrato próximo a vencer
            </p>
          </div>
        )}

        {/* Active Modification Banner */}
        {store.activeModification && (
          <div className="mb-4 p-3 bg-indigo-50 border-l-4 border-indigo-400 rounded-r-md">
            <p className="text-sm font-medium text-indigo-800">
              Modificación temporal activa
            </p>
            <p className="text-xs text-indigo-700 mt-1">
              Válida hasta {new Date(store.activeModification.endDate).toLocaleDateString('es-CL')}
            </p>
          </div>
        )}

        {/* Information Grid */}
        <div className="space-y-4 mb-6 flex-1">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Operador:
            </span>
            <span className="font-semibold text-gray-900 text-right">
              {store.shoppingCenterOperator || 'N/A'}
            </span>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Superficie de Sala:
            </span>
            <span className="font-semibold text-gray-900">
              {formatNumber(store.surfaceAreaHall)} m²
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Superficie Total:
            </span>
            <span className="font-semibold text-gray-900">
              {formatNumber(store.surfaceAreaTotal)} m²
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Superficie de Bodega:
            </span>
            <span className="font-semibold text-gray-900">
              {formatNumber(surfaceAreaWarehouse)} m²
            </span>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              VMM:
            </span>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${store.activeModification ? 'text-indigo-600' : 'text-gray-900'}`}>
                {formatNumber(store.minimumMonthlyRent)} UF$
              </span>
              {store.activeModification && (
                <Badge variant="default" size="sm" className="bg-indigo-100 text-indigo-700">
                  Temp
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Gastos comunes:
            </span>
            <span className="font-semibold text-gray-900">
              {formatNumber(store.commonExpenses)} UF$/m²
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Fondo de promoción:
            </span>
            <span className="font-semibold text-gray-900">
              {formatNumber(store.promotionFund)}% del VMM
            </span>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Término:
            </span>
            <span className={`font-semibold ${alertColor}`}>
              {formatDate(store.contractEndDate)}
            </span>
          </div>

          {/* Renovación automática */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Renovación automática:
            </span>
            <span className="font-semibold text-gray-900">
              {store.autoRenewal ? 'Sí' : 'No'}
            </span>
          </div>

          {/* Aumento automático */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Aumento automático:
            </span>
            <span className="font-semibold text-gray-900 text-right max-w-[60%]">
              {store.rentIncreaseType === 'ANNUAL'
                ? (typeof store.annualRentIncreasePercentage === 'number'
                  ? `${formatNumber(store.annualRentIncreasePercentage)}% anual`
                  : 'Sin aumento')
                : store.rentIncreaseType === 'SPECIFIC_DATES'
                ? `${store.rentIncreaseDates?.length || 0} fecha(s) específica(s)`
                : 'Sin aumento'
              }
            </span>
          </div>

          {/* Garantía */}
          {store.guaranteeType && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">
                Garantía:
              </span>
              <span className="font-semibold text-gray-900 text-right max-w-[60%]">
                {store.guaranteeType === 'CASH' ? 'Efectivo' : 'Boleta bancaria'}
                {store.guaranteeAmount && (
                  <span className="block text-xs text-gray-600 mt-1">
                    {formatNumber(store.guaranteeAmount)} {store.guaranteeCurrency === 'CLP' ? '$' : 'UF$'}
                  </span>
                )}
              </span>
            </div>
          )}

          {store.status === 'ACTIVE' && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">
                Días restantes:
              </span>
              <span className={`font-bold text-lg ${alertColor}`}>
                {daysUntilEnd > 0 ? `${daysUntilEnd} días` : 'Vencido'}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <Link href={`/stores/${store.id}`} className="flex-1">
            <Button variant="primary" size="sm" className="w-full">
              Ver Detalle
            </Button>
          </Link>
          {store.status === 'ACTIVE' && (
            <EditContractAction
              storeId={store.id}
              variant="secondary"
              size="sm"
              className="flex-1 w-full"
            >
              Editar
            </EditContractAction>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
