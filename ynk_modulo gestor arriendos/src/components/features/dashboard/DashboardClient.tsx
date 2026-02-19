'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Store, StoreFilters, StoreSort, StoreStatus, SortField } from '@/types/store'
import StoreModal from '@/components/features/stores/StoreModal'
import StoreFiltersComponent from '@/components/features/stores/StoreFilters'
import SortableTableHeader from '@/components/SortableTableHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EditContractAction from '@/components/features/stores/EditContractAction'
import { calculateDaysUntil, formatDate, getAlertColor, buildStoreQueryParams } from '@/lib/utils'
import { formatNumber } from '@/lib/utils/format'
import UFValueCard from '@/components/features/uf/UFValueCard'
import { canManageStores, UserRole } from '@/lib/utils/permissions'
import { User } from 'next-auth'

interface DashboardClientProps {
    initialStores: Store[]
    allStores: Store[] // For KPIs
    operators: string[]
    initialFilters: StoreFilters
    initialSort: StoreSort
    user: User & { role: string }
}

export default function DashboardClient({
    initialStores,
    allStores,
    operators,
    initialFilters,
    initialSort,
    user
}: DashboardClientProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)

    // Local state for filters to avoid UI lag while typing, though source of truth is URL
    const [filters, setFilters] = useState<StoreFilters>(initialFilters)
    const [sort, setSort] = useState<StoreSort>(initialSort)

    // Sync local state when URL changes (e.g. back button)
    useEffect(() => {
        setFilters(initialFilters)
        setSort(initialSort)
    }, [initialFilters, initialSort])

    // Update URL when filters/sort change
    const updateUrl = (newFilters: StoreFilters, newSort: StoreSort) => {
        const params = buildStoreQueryParams(newFilters, newSort)
        const newUrl = params.toString() ? `?${params.toString()}` : pathname
        router.push(newUrl, { scroll: false })
    }

    const handleFiltersChange = (newFilters: StoreFilters) => {
        setFilters(newFilters)
        // Debounce search if needed, but for now direct update
        // Ideally useDebounce for search text
        updateUrl(newFilters, sort)
    }

    const handleClearAllFilters = () => {
        const defaultFilters: StoreFilters = {
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
        setFilters(defaultFilters)
        updateUrl(defaultFilters, sort)
    }

    const handleSort = (field: SortField) => {
        const newSort: StoreSort = {
            field,
            order: sort.field === field && sort.order === 'asc' ? 'desc' : 'asc',
        }
        setSort(newSort)
        updateUrl(filters, newSort)
    }

    // Calculate KPIs
    const allActiveStores = allStores.filter(s => s.status === 'ACTIVE')
    const allTerminatedStores = allStores.filter(s => s.status === 'TERMINATED')
    const totalStoresCount = allStores.length
    const activeStoresCount = allActiveStores.length
    const terminatedStoresCount = allTerminatedStores.length

    const totalVMM = allActiveStores.reduce((sum, store) => sum + (store.minimumMonthlyRent || 0), 0)
    const totalM2 = allActiveStores.reduce((sum, store) => sum + (store.surfaceAreaTotal || 0), 0)
    const expiringStoresCount = allActiveStores.filter(store => {
        const daysUntilEnd = calculateDaysUntil(store.contractEndDate)
        return daysUntilEnd <= 90 && daysUntilEnd >= 0
    }).length

    const refreshData = () => {
        router.refresh()
    }

    return (
        <div className="space-y-12">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Bienvenido, {user.name || 'Usuario'}
                    </h1>
                    <p className="text-base text-gray-600">
                        ¿Qué quieres hacer hoy?
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => router.push('/stores/expiring')}
                        className="w-full sm:w-auto"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Próximos vencimientos
                    </Button>
                    {canManageStores(user.role as any) && (
                        <>
                            <Link href="/stores/edit" className="w-full sm:w-auto">
                                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Modificar tienda
                                </Button>
                            </Link>
                            <Link href="/stores/new" className="w-full sm:w-auto">
                                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Agregar tienda
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        Resumen de KPI's
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Indicadores clave de rendimiento de tus tiendas
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-start">
                    <Card hover padding="none" className="cursor-default">
                        <CardContent className="py-3 px-6">
                            <div className="flex items-center gap-2">
                                <p className="flex-1 text-sm font-medium text-gray-600 truncate">Total Tiendas</p>
                                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <p className="mt-1.5 text-xl font-semibold text-gray-900 whitespace-nowrap">{totalStoresCount}</p>
                        </CardContent>
                    </Card>

                    <button
                        onClick={() => handleFiltersChange({ ...filters, status: StoreStatus.ACTIVE })}
                        className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50"
                    >
                        <Card
                            hover
                            padding="none"
                            className={`cursor-pointer transition-all ${filters.status === StoreStatus.ACTIVE ? 'ring-2 ring-indigo-500' : ''}`}
                        >
                            <CardContent className="py-3 px-6">
                                <div className="flex items-center gap-2">
                                    <p className="flex-1 text-sm font-medium text-gray-600 truncate">Activas</p>
                                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="mt-1.5 text-xl font-semibold text-green-600 whitespace-nowrap">{activeStoresCount}</p>
                            </CardContent>
                        </Card>
                    </button>

                    <button
                        onClick={() => router.push('/stores/expiring')}
                        className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50"
                    >
                        <Card
                            hover
                            padding="none"
                            className="cursor-pointer transition-all hover:shadow-lg"
                        >
                            <CardContent className="py-3 px-6">
                                <div className="flex items-center gap-2">
                                    <p className="flex-1 text-sm font-medium text-gray-600 truncate">Por revisar</p>
                                    <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <p className="mt-1.5 text-xl font-semibold text-orange-600 whitespace-nowrap">{expiringStoresCount}</p>
                            </CardContent>
                        </Card>
                    </button>

                    <button
                        onClick={() => handleFiltersChange({ ...filters, status: filters.status === StoreStatus.TERMINATED ? 'ALL' : StoreStatus.TERMINATED })}
                        className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50"
                    >
                        <Card
                            hover
                            padding="none"
                            className={`cursor-pointer transition-all ${filters.status === StoreStatus.TERMINATED ? 'ring-2 ring-indigo-500' : ''}`}
                        >
                            <CardContent className="py-3 px-6">
                                <div className="flex items-center gap-2">
                                    <p className="flex-1 text-sm font-medium text-gray-600 truncate">Terminadas</p>
                                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <p className="mt-1.5 text-xl font-semibold text-gray-600 whitespace-nowrap">{terminatedStoresCount}</p>
                            </CardContent>
                        </Card>
                    </button>

                    <Card hover padding="none" className="cursor-default">
                        <CardContent className="py-3 px-6">
                            <div className="flex items-center gap-2">
                                <p className="flex-1 text-sm font-medium text-gray-600 truncate">VMM Total</p>
                                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="mt-1.5 text-xl font-semibold text-gray-900 whitespace-nowrap">{formatNumber(totalVMM)} UF$</p>
                        </CardContent>
                    </Card>

                    <Card hover padding="none" className="cursor-default">
                        <CardContent className="py-3 px-6">
                            <div className="flex items-center gap-2">
                                <p className="flex-1 text-sm font-medium text-gray-600 truncate">m² Totales</p>
                                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </div>
                            <p className="mt-1.5 text-xl font-semibold text-gray-900 whitespace-nowrap">{formatNumber(totalM2)} m²</p>
                        </CardContent>
                    </Card>

                    <UFValueCard />
                </div>
            </div>

            {/* Filters Section */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        Búsqueda y Filtros
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Encuentra tiendas específicas usando los filtros disponibles
                    </p>
                </div>
                <StoreFiltersComponent
                    filters={filters}
                    operators={operators}
                    onFiltersChange={handleFiltersChange}
                    onClearAll={handleClearAllFilters}
                />
            </div>

            {/* Stores Table or Empty State */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        Listado de Tiendas
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        {initialStores.length > 0
                            ? `Mostrando ${initialStores.length} tienda${initialStores.length !== 1 ? 's' : ''}`
                            : 'No hay tiendas para mostrar'}
                    </p>
                </div>
                <div>
                    {initialStores.length === 0 ? (
                        <Card>
                            <CardContent className="p-16 text-center">
                                <div className="max-w-md mx-auto">
                                    <svg className="w-20 h-20 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                                        {filters.search || filters.status !== 'ACTIVE' || filters.operator || filters.surfaceMin !== null || filters.surfaceMax !== null || filters.vmmMin !== null || filters.vmmMax !== null || filters.dateFrom || filters.dateTo
                                            ? 'No se encontraron tiendas'
                                            : 'No hay tiendas registradas'}
                                    </h3>
                                    <p className="text-gray-600 mb-8 text-base">
                                        {filters.search || filters.status !== 'ACTIVE' || filters.operator || filters.surfaceMin !== null || filters.surfaceMax !== null || filters.vmmMin !== null || filters.vmmMax !== null || filters.dateFrom || filters.dateTo
                                            ? 'Intenta ajustar los filtros de búsqueda para encontrar lo que buscas.'
                                            : 'Comienza creando tu primera tienda para gestionar contratos y arriendos.'}
                                    </p>
                                    {(!filters.search && filters.status === 'ACTIVE' && !filters.operator && filters.surfaceMin === null && filters.surfaceMax === null && filters.vmmMin === null && filters.vmmMax === null && !filters.dateFrom && !filters.dateTo) && canManageStores(user.role as any) && (
                                        <Link href="/stores/new">
                                            <Button variant="primary" size="lg">
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Crear Primera Tienda
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden lg:block">
                                <Card padding="none">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <SortableTableHeader
                                                        field="storeName"
                                                        currentField={sort.field}
                                                        currentOrder={sort.order}
                                                        onSort={handleSort}
                                                    >
                                                        Tienda
                                                    </SortableTableHeader>
                                                    <SortableTableHeader
                                                        field="banner"
                                                        currentField={sort.field}
                                                        currentOrder={sort.order}
                                                        onSort={handleSort}
                                                    >
                                                        Banner
                                                    </SortableTableHeader>
                                                    <SortableTableHeader
                                                        field="shoppingCenterOperator"
                                                        currentField={sort.field}
                                                        currentOrder={sort.order}
                                                        onSort={handleSort}
                                                    >
                                                        Operador
                                                    </SortableTableHeader>
                                                    <SortableTableHeader
                                                        field="surfaceAreaTotal"
                                                        currentField={sort.field}
                                                        currentOrder={sort.order}
                                                        onSort={handleSort}
                                                    >
                                                        Superficie Total
                                                    </SortableTableHeader>
                                                    <SortableTableHeader
                                                        field="minimumMonthlyRent"
                                                        currentField={sort.field}
                                                        currentOrder={sort.order}
                                                        onSort={handleSort}
                                                    >
                                                        VMM
                                                    </SortableTableHeader>
                                                    <SortableTableHeader
                                                        field="contractEndDate"
                                                        currentField={sort.field}
                                                        currentOrder={sort.order}
                                                        onSort={handleSort}
                                                    >
                                                        Fecha Término
                                                    </SortableTableHeader>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                        Estado
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                        Acciones
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {initialStores.map((store) => {
                                                    const daysUntilEnd = calculateDaysUntil(store.contractEndDate)
                                                    const alertColor = getAlertColor(daysUntilEnd)

                                                    return (
                                                        <tr
                                                            key={store.id}
                                                            className="hover:bg-gray-50 transition-colors"
                                                        >
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                <div className="text-sm font-semibold text-gray-900">
                                                                    {store.storeName}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                <div className="text-sm text-gray-600">
                                                                    {store.banner}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                <div className="text-sm text-gray-600">
                                                                    {store.shoppingCenterOperator || 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {formatNumber(store.surfaceAreaTotal)} m²
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {formatNumber(store.minimumMonthlyRent)} UF$
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                <div className={`text-sm font-medium ${alertColor}`}>
                                                                    {formatDate(store.contractEndDate)}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                <Badge
                                                                    variant={
                                                                        store.status === 'ACTIVE' ? 'success' : 'default'
                                                                    }
                                                                    size="sm"
                                                                >
                                                                    {store.status === 'ACTIVE' ? 'Activo' : 'Terminado'}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setSelectedStoreId(store.id)}
                                                                        className="text-indigo-600 hover:text-indigo-800"
                                                                    >
                                                                        Ver
                                                                    </Button>
                                                                    {store.status === 'ACTIVE' && (
                                                                        <EditContractAction
                                                                            storeId={store.id}
                                                                            variant="secondary"
                                                                            size="sm"
                                                                        >
                                                                            Editar
                                                                        </EditContractAction>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>

                            {/* Mobile Cards */}
                            <div className="lg:hidden space-y-4">
                                {initialStores.map((store) => {
                                    const daysUntilEnd = calculateDaysUntil(store.contractEndDate)
                                    const alertColor = getAlertColor(daysUntilEnd)

                                    return (
                                        <Card key={store.id} hover>
                                            <CardContent className="p-5">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex-1">
                                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                                            {store.storeName}
                                                        </h3>
                                                        <p className="text-sm text-gray-600">{store.banner}</p>
                                                    </div>
                                                    <Badge
                                                        variant={store.status === 'ACTIVE' ? 'success' : 'default'}
                                                        size="sm"
                                                    >
                                                        {store.status === 'ACTIVE' ? 'Activo' : 'Terminado'}
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

                                                <div className="flex gap-2 pt-3 border-t border-gray-200">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setSelectedStoreId(store.id)}
                                                        className="flex-1 text-indigo-600 hover:text-indigo-800"
                                                    >
                                                        Ver
                                                    </Button>
                                                    {store.status === 'ACTIVE' && (
                                                        <EditContractAction
                                                            storeId={store.id}
                                                            variant="secondary"
                                                            size="sm"
                                                            className="w-full"
                                                        >
                                                            Editar
                                                        </EditContractAction>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>

                            <StoreModal
                                isOpen={selectedStoreId !== null}
                                onClose={() => setSelectedStoreId(null)}
                                storeId={selectedStoreId}
                                onStoreUpdated={() => refreshData()}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
