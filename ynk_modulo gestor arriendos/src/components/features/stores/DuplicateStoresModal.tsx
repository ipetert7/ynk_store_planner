'use client'

import { useState, useEffect } from 'react'
import { Store, StoreFormData } from '@/types/store'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { formatNumber } from '@/lib/utils/format'

interface DuplicateItem {
  row: number
  erpId: string
  excelData: StoreFormData
  existingStore: Store
}

interface DuplicateStoresModalProps {
  duplicates: DuplicateItem[]
  isOpen: boolean
  onClose: () => void
  onConfirm: (decisions: Record<string, 'update' | 'skip'>) => void
}

type DecisionType = 'update' | 'skip' | null

export default function DuplicateStoresModal({
  duplicates,
  isOpen,
  onClose,
  onConfirm,
}: DuplicateStoresModalProps) {
  const [decisions, setDecisions] = useState<Record<string, DecisionType>>({})
  const [applyToAll, setApplyToAll] = useState<DecisionType>(null)

  // Inicializar decisiones cuando cambian los duplicados
  useEffect(() => {
    if (isOpen && duplicates.length > 0) {
      const initialDecisions: Record<string, DecisionType> = {}
      duplicates.forEach(duplicate => {
        initialDecisions[duplicate.erpId] = null
      })
      setDecisions(initialDecisions)
      setApplyToAll(null)
    }
  }, [isOpen, duplicates])

  // Aplicar decisión a todas las filas cuando cambia applyToAll
  useEffect(() => {
    if (applyToAll) {
      const newDecisions: Record<string, DecisionType> = {}
      duplicates.forEach(duplicate => {
        newDecisions[duplicate.erpId] = applyToAll
      })
      setDecisions(newDecisions)
    }
  }, [applyToAll, duplicates])

  const handleIndividualDecision = (erpId: string, decision: DecisionType) => {
    setDecisions(prev => ({
      ...prev,
      [erpId]: decision
    }))

    // Si el usuario cambia una decisión individual, resetear "aplicar a todas"
    if (applyToAll) {
      setApplyToAll(null)
    }
  }

  const handleApplyToAll = () => {
    if (!applyToAll) return
    setDecisions(prev => {
      const newDecisions = { ...prev }
      duplicates.forEach(duplicate => {
        newDecisions[duplicate.erpId] = applyToAll
      })
      return newDecisions
    })
  }

  const handleConfirm = () => {
    // Verificar que todas las filas tengan una decisión
    const incompleteDecisions = duplicates.filter(duplicate => !decisions[duplicate.erpId])
    if (incompleteDecisions.length > 0) {
      alert(`Debes seleccionar una acción para todas las tiendas duplicadas. Faltan ${incompleteDecisions.length} decisiones.`)
      return
    }

    const finalDecisions: Record<string, 'update' | 'skip'> = {}
    duplicates.forEach(duplicate => {
      const decision = decisions[duplicate.erpId]
      if (decision) {
        finalDecisions[duplicate.erpId] = decision
      }
    })

    onConfirm(finalDecisions)
  }

  const handleCancel = () => {
    onClose()
  }

  // Contar decisiones completadas
  const completedDecisions = duplicates.filter(duplicate => decisions[duplicate.erpId]).length

  // Función para comparar valores y determinar si son diferentes
  const areDifferent = (excelValue: any, existingValue: any): boolean => {
    if (excelValue === null || excelValue === undefined) return false
    if (existingValue === null || existingValue === undefined) return true
    return String(excelValue) !== String(existingValue)
  }

  // Función para formatear valores para display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return '-'
    if (typeof value === 'number') {
      // Usar formato chileno con máximo 1 decimal
      return formatNumber(value)
    }
    if (typeof value === 'boolean') return value ? 'Sí' : 'No'
    return String(value)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tiendas Duplicadas Encontradas"
      size="xl"
    >
      <div className="space-y-6">
        {/* Header con información */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-800">
                Se encontraron {duplicates.length} tienda{duplicates.length !== 1 ? 's' : ''} con ID{duplicates.length !== 1 ? 's' : ''} del ERP ya existente{duplicates.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Para cada tienda, elige si deseas actualizar la información existente o omitir la fila del Excel.
              </p>
            </div>
          </div>
        </div>

        {/* Contador de progreso */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {completedDecisions} de {duplicates.length} tienda{duplicates.length !== 1 ? 's' : ''} con decisión seleccionada
          </p>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">Aplicar a todas:</span>
            <select
              value={applyToAll || ''}
              onChange={(e) => setApplyToAll(e.target.value as DecisionType)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccionar...</option>
              <option value="update">Actualizar</option>
              <option value="skip">Omitir</option>
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleApplyToAll}
              disabled={!applyToAll}
            >
              Aplicar
            </Button>
          </div>
        </div>

        {/* Tabla de comparación */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fila Excel
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID ERP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Excel
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Existente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {duplicates.map((duplicate) => {
                const fields = [
                  { key: 'storeName', label: 'Nombre Tienda' },
                  { key: 'banner', label: 'Banner' },
                  { key: 'surfaceAreaHall', label: 'Superficie Sala' },
                  { key: 'surfaceAreaTotal', label: 'Superficie Total' },
                  { key: 'shoppingCenterOperator', label: 'Operador' },
                  { key: 'contractStartDate', label: 'Fecha Inicio' },
                  { key: 'contractEndDate', label: 'Fecha Término' },
                  { key: 'minimumMonthlyRent', label: 'VMM' },
                  { key: 'percentageRent', label: 'Porcentaje' },
                  { key: 'decemberFactor', label: 'Factor Diciembre' },
                  { key: 'commonExpenses', label: 'Gastos Comunes' },
                  { key: 'promotionFund', label: 'Fondo Promoción' },
                  { key: 'notificationPeriodDays', label: 'Días Notificación' },
                  { key: 'autoRenewal', label: 'Renovación Automática' },
                ]

                return (
                  <tr key={duplicate.erpId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {duplicate.row}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {duplicate.erpId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {fields.map((field) => {
                          const excelValue = (duplicate.excelData as any)[field.key]
                          const existingValue = (duplicate.existingStore as any)[field.key]
                          const hasDifference = areDifferent(excelValue, existingValue)

                          return hasDifference ? (
                            <div key={field.key} className="text-xs text-gray-600">
                              {field.label}
                            </div>
                          ) : null
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {fields.map((field) => {
                          const excelValue = (duplicate.excelData as any)[field.key]
                          const existingValue = (duplicate.existingStore as any)[field.key]
                          const hasDifference = areDifferent(excelValue, existingValue)

                          return hasDifference ? (
                            <div key={field.key} className={`text-xs ${hasDifference ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                              {formatValue(excelValue)}
                            </div>
                          ) : null
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {fields.map((field) => {
                          const excelValue = (duplicate.excelData as any)[field.key]
                          const existingValue = (duplicate.existingStore as any)[field.key]
                          const hasDifference = areDifferent(excelValue, existingValue)

                          return hasDifference ? (
                            <div key={field.key} className={`text-xs ${hasDifference ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                              {formatValue(existingValue)}
                            </div>
                          ) : null
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col space-y-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name={`decision-${duplicate.erpId}`}
                            value="update"
                            checked={decisions[duplicate.erpId] === 'update'}
                            onChange={() => handleIndividualDecision(duplicate.erpId, 'update')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span className="ml-2 text-xs text-gray-700">Actualizar</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name={`decision-${duplicate.erpId}`}
                            value="skip"
                            checked={decisions[duplicate.erpId] === 'skip'}
                            onChange={() => handleIndividualDecision(duplicate.erpId, 'skip')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span className="ml-2 text-xs text-gray-700">Omitir</span>
                        </label>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer con botones */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
          >
            Cancelar Importación
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={completedDecisions !== duplicates.length}
          >
            Confirmar ({completedDecisions}/{duplicates.length})
          </Button>
        </div>
      </div>
    </Modal>
  )
}
