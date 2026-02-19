'use client'

import { useState, useEffect, useRef } from 'react'
import { StoreFilters as StoreFiltersType, StoreStatus } from '@/types/store'
import { Card, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface StoreFiltersProps {
  filters: StoreFiltersType
  operators: string[]
  onFiltersChange: (filters: StoreFiltersType) => void
  onClearAll: () => void
}

export default function StoreFilters({
  filters,
  operators,
  onFiltersChange,
  onClearAll,
}: StoreFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localFilters, setLocalFilters] = useState<StoreFiltersType>(filters)
  const [searchValue, setSearchValue] = useState<string>(filters.search)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalFilters(filters)
    setSearchValue(filters.search)
  }, [filters])

  // Debounce para búsqueda de texto
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      if (searchValue !== filters.search) {
        handleFilterChange('search', searchValue)
      }
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchValue, filters.search])

  const handleFilterChange = (key: keyof StoreFiltersType, value: any) => {
    const updated = { ...localFilters, [key]: value }
    setLocalFilters(updated)
    onFiltersChange(updated)
  }

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
  }

  const hasActiveFilters = () => {
    return (
      localFilters.search !== '' ||
      localFilters.status !== 'ACTIVE' ||
      localFilters.operator !== '' ||
      localFilters.surfaceMin !== null ||
      localFilters.surfaceMax !== null ||
      localFilters.vmmMin !== null ||
      localFilters.vmmMax !== null ||
      localFilters.dateFrom !== null ||
      localFilters.dateTo !== null
    )
  }

  const removeFilter = (key: keyof StoreFiltersType) => {
    const defaultValue: any = {
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
    handleFilterChange(key, defaultValue[key])
  }

  const activeFiltersCount = Object.values(localFilters).filter((v) => {
    if (v === null) return false
    if (typeof v === 'string') return v !== '' && v !== 'ALL'
    return true
  }).length

  return (
    <Card padding="none">
      <CardContent className="py-4 px-5">
        {/* Header con búsqueda principal y botón expandir */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end">
            {/* Búsqueda principal */}
            <div className="w-full">
              <Input
                id="search-input"
                type="text"
                label="Buscar"
                placeholder="Buscar por nombre, banner o operador..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-11 bg-white py-2.5 pr-4 text-sm"
                leftIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>

            {/* Filtro de estado */}
            <div className="w-full">
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1.5">
                Estado
              </label>
              <div className="relative">
                <select
                  id="status-filter"
                  value={localFilters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value as StoreStatus | 'ALL')}
                  className="block w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-10 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 h-11"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="TERMINATED">Terminados</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.07l3.71-3.84a.75.75 0 011.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Botón para expandir filtros avanzados */}
            <div className="w-full lg:justify-self-end">
              <Button
                variant={isExpanded ? 'primary' : 'secondary'}
                size="md"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full lg:w-auto h-11 px-5"
              >
                <svg
                  className={cn('w-5 h-5 mr-2 transition-transform duration-200', isExpanded && 'rotate-180')}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Filtros Avanzados
                {activeFiltersCount > 0 && (
                  <span className={cn(
                    "ml-2 px-2 py-0.5 text-xs rounded-full font-semibold transition-colors",
                    isExpanded ? "bg-white text-indigo-600" : "bg-indigo-600 text-white"
                  )}>
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Panel de filtros avanzados (colapsable) */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
            {/* Grupo: Operador */}
            <div>
              <label htmlFor="operator-filter" className="block text-sm font-semibold text-gray-900 mb-3">
                Operador
              </label>
              <div className="relative">
                <select
                  id="operator-filter"
                  value={localFilters.operator}
                  onChange={(e) => handleFilterChange('operator', e.target.value)}
                  className="block w-full appearance-none rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 py-2.5 pl-10 pr-10 text-sm h-11 bg-white"
                >
                  <option value="">Todos los operadores</option>
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.07l3.71-3.84a.75.75 0 011.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Grupo: Superficie */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Superficie (m²)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="surface-min" className="block text-xs text-gray-600 mb-1.5">
                    Mínima
                  </label>
                  <Input
                    id="surface-min"
                    type="number"
                    placeholder="Ej: 50"
                    value={localFilters.surfaceMin?.toString() || ''}
                    onChange={(e) =>
                      handleFilterChange('surfaceMin', e.target.value ? parseFloat(e.target.value) : null)
                    }
                    min="0"
                    step="0.01"
                    leftIcon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    }
                  />
                </div>
                <div>
                  <label htmlFor="surface-max" className="block text-xs text-gray-600 mb-1.5">
                    Máxima
                  </label>
                  <Input
                    id="surface-max"
                    type="number"
                    placeholder="Ej: 200"
                    value={localFilters.surfaceMax?.toString() || ''}
                    onChange={(e) =>
                      handleFilterChange('surfaceMax', e.target.value ? parseFloat(e.target.value) : null)
                    }
                    min="0"
                    step="0.01"
                    leftIcon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>

            {/* Grupo: VMM */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Valor Mínimo Mensual (VMM) - UF$
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vmm-min" className="block text-xs text-gray-600 mb-1.5">
                    Mínimo
                  </label>
                  <Input
                    id="vmm-min"
                    type="number"
                    placeholder="Ej: 100"
                    value={localFilters.vmmMin?.toString() || ''}
                    onChange={(e) =>
                      handleFilterChange('vmmMin', e.target.value ? parseFloat(e.target.value) : null)
                    }
                    min="0"
                    step="0.01"
                    leftIcon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                </div>
                <div>
                  <label htmlFor="vmm-max" className="block text-xs text-gray-600 mb-1.5">
                    Máximo
                  </label>
                  <Input
                    id="vmm-max"
                    type="number"
                    placeholder="Ej: 1000"
                    value={localFilters.vmmMax?.toString() || ''}
                    onChange={(e) =>
                      handleFilterChange('vmmMax', e.target.value ? parseFloat(e.target.value) : null)
                    }
                    min="0"
                    step="0.01"
                    leftIcon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>

            {/* Grupo: Fechas */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Fecha de Término del Contrato
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date-from" className="block text-xs text-gray-600 mb-1.5">
                    Desde
                  </label>
                  <Input
                    id="date-from"
                    type="date"
                    value={localFilters.dateFrom || ''}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value || null)}
                    leftIcon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                  />
                </div>
                <div>
                  <label htmlFor="date-to" className="block text-xs text-gray-600 mb-1.5">
                    Hasta
                  </label>
                  <Input
                    id="date-to"
                    type="date"
                    value={localFilters.dateTo || ''}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value || null)}
                    leftIcon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chips de filtros activos */}
        {hasActiveFilters() && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-medium text-gray-700">Filtros activos:</span>
              {localFilters.search && (
                <Badge variant="info" size="sm" className="flex items-center gap-1.5 px-2.5 py-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-xs">{localFilters.search}</span>
                  <button
                    onClick={() => removeFilter('search')}
                    className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    aria-label="Remover filtro de búsqueda"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Badge>
              )}
              {localFilters.status !== 'ACTIVE' && (
                <Badge variant="info" size="sm" className="flex items-center gap-1.5 px-2.5 py-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs">{localFilters.status === 'TERMINATED' ? 'Terminados' : 'Todos los estados'}</span>
                  <button
                    onClick={() => removeFilter('status')}
                    className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    aria-label="Remover filtro de estado"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Badge>
              )}
              {localFilters.operator && (
                <Badge variant="info" size="sm" className="flex items-center gap-1.5 px-2.5 py-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-xs">{localFilters.operator}</span>
                  <button
                    onClick={() => removeFilter('operator')}
                    className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    aria-label="Remover filtro de operador"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Badge>
              )}
              {(localFilters.surfaceMin !== null || localFilters.surfaceMax !== null) && (
                <Badge variant="info" size="sm" className="flex items-center gap-1.5 px-2.5 py-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span className="text-xs">
                    {localFilters.surfaceMin !== null ? `${localFilters.surfaceMin}` : '0'} -{' '}
                    {localFilters.surfaceMax !== null ? `${localFilters.surfaceMax}` : '∞'} m²
                  </span>
                  <button
                    onClick={() => {
                      removeFilter('surfaceMin')
                      removeFilter('surfaceMax')
                    }}
                    className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    aria-label="Remover filtro de superficie"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Badge>
              )}
              {(localFilters.vmmMin !== null || localFilters.vmmMax !== null) && (
                <Badge variant="info" size="sm" className="flex items-center gap-1.5 px-2.5 py-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs">
                    {localFilters.vmmMin !== null ? `${localFilters.vmmMin}` : '0'} -{' '}
                    {localFilters.vmmMax !== null ? `${localFilters.vmmMax}` : '∞'} UF$
                  </span>
                  <button
                    onClick={() => {
                      removeFilter('vmmMin')
                      removeFilter('vmmMax')
                    }}
                    className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    aria-label="Remover filtro de VMM"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Badge>
              )}
              {(localFilters.dateFrom || localFilters.dateTo) && (
                <Badge variant="info" size="sm" className="flex items-center gap-1.5 px-2.5 py-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs">
                    {localFilters.dateFrom
                      ? new Date(localFilters.dateFrom).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
                      : 'Inicio'}{' '}
                    -{' '}
                    {localFilters.dateTo
                      ? new Date(localFilters.dateTo).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
                      : 'Fin'}
                  </span>
                  <button
                    onClick={() => {
                      removeFilter('dateFrom')
                      removeFilter('dateTo')
                    }}
                    className="ml-0.5 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    aria-label="Remover filtro de fechas"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Badge>
              )}
              <button
                onClick={onClearAll}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium ml-2 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
              >
                Limpiar todos
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
