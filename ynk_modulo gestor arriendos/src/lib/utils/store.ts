import { Store, StoreFilters, StoreSort, SortField, SortOrder, StoreStatus, TemporaryModification } from '@/types/store'

/**
 * Verifica si está próximo el plazo de notificación
 */
export function isNotificationDue(store: Store): boolean {
  const today = new Date()
  const notificationDate = new Date(store.contractEndDate)
  notificationDate.setDate(notificationDate.getDate() - store.notificationPeriodDays)
  
  return today >= notificationDate && store.status === 'ACTIVE'
}

/**
 * Calcula la fecha de notificación (fecha término - días de notificación)
 */
export function getNotificationDate(store: Store): Date {
  const notificationDate = new Date(store.contractEndDate)
  notificationDate.setDate(notificationDate.getDate() - store.notificationPeriodDays)
  return notificationDate
}

/**
 * Construye query params desde filtros y ordenamiento
 */
export function buildStoreQueryParams(
  filters: StoreFilters,
  sort: StoreSort
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.search) {
    params.append('search', filters.search)
  }

  if (filters.status && filters.status !== 'ALL') {
    params.append('status', filters.status)
  }

  if (filters.operator) {
    params.append('operator', filters.operator)
  }

  if (filters.surfaceMin !== null && filters.surfaceMin !== undefined) {
    params.append('surfaceMin', filters.surfaceMin.toString())
  }

  if (filters.surfaceMax !== null && filters.surfaceMax !== undefined) {
    params.append('surfaceMax', filters.surfaceMax.toString())
  }

  if (filters.vmmMin !== null && filters.vmmMin !== undefined) {
    params.append('vmmMin', filters.vmmMin.toString())
  }

  if (filters.vmmMax !== null && filters.vmmMax !== undefined) {
    params.append('vmmMax', filters.vmmMax.toString())
  }

  if (filters.dateFrom) {
    params.append('dateFrom', filters.dateFrom)
  }

  if (filters.dateTo) {
    params.append('dateTo', filters.dateTo)
  }

  if (sort.field) {
    params.append('sortBy', sort.field)
    params.append('sortOrder', sort.order)
  }

  return params
}

/**
 * Parsea query params a estado de filtros y ordenamiento
 */
export function parseStoreQueryParams(searchParams: URLSearchParams): {
  filters: StoreFilters
  sort: StoreSort
} {
  const filters: StoreFilters = {
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as StoreStatus | 'ALL') || StoreStatus.ACTIVE,
    operator: searchParams.get('operator') || '',
    surfaceMin: searchParams.get('surfaceMin')
      ? parseFloat(searchParams.get('surfaceMin')!)
      : null,
    surfaceMax: searchParams.get('surfaceMax')
      ? parseFloat(searchParams.get('surfaceMax')!)
      : null,
    vmmMin: searchParams.get('vmmMin')
      ? parseFloat(searchParams.get('vmmMin')!)
      : null,
    vmmMax: searchParams.get('vmmMax')
      ? parseFloat(searchParams.get('vmmMax')!)
      : null,
    dateFrom: searchParams.get('dateFrom') || null,
    dateTo: searchParams.get('dateTo') || null,
  }

  const sortField = searchParams.get('sortBy') as SortField | null
  const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'asc'

  const sort: StoreSort = {
    field: sortField,
    order: sortOrder,
  }

  return { filters, sort }
}

/**
 * Obtiene lista única de operadores desde un array de tiendas
 */
export function getUniqueOperators(stores: Store[]): string[] {
  const canonicalByNormalized = new Map<string, string>()

  stores
    .map((store) => store.shoppingCenterOperator)
    .forEach((operator) => {
      const normalized = normalizeOperatorName(operator)
      if (normalized && !canonicalByNormalized.has(normalized)) {
        canonicalByNormalized.set(normalized, cleanOperatorName(operator))
      }
    })

  return Array.from(canonicalByNormalized.values()).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  )
}

/**
 * Limpia nombre de operador (trim + colapso de espacios)
 */
export function cleanOperatorName(operator: string | null | undefined): string {
  return (operator ?? '').trim().replace(/\s+/g, ' ')
}

/**
 * Normaliza para comparar operadores (sin alterar formato canónico mostrado)
 */
export function normalizeOperatorName(operator: string | null | undefined): string {
  return cleanOperatorName(operator).toLocaleLowerCase('es-CL')
}

/**
 * Verifica si una modificación está activa para una fecha dada
 */
export function isModificationActive(modification: TemporaryModification, date: Date = new Date()): boolean {
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)
  
  const startDate = new Date(modification.startDate)
  startDate.setHours(0, 0, 0, 0)
  
  const endDate = new Date(modification.endDate)
  endDate.setHours(23, 59, 59, 999)
  
  return checkDate >= startDate && checkDate <= endDate
}

/**
 * Aplica los valores de una modificación temporal a un objeto Store
 */
export function applyModification(store: Store, modification: TemporaryModification): Store {
  return {
    ...store,
    minimumMonthlyRent: modification.minimumMonthlyRent,
    percentageRent: modification.percentageRent,
    decemberFactor: modification.decemberFactor,
    activeModification: modification,
  }
}

/**
 * Obtiene la modificación activa más reciente de un array de modificaciones
 * Si hay múltiples modificaciones activas, retorna la más reciente (por fecha de creación)
 */
export function getActiveModification(
  modifications: TemporaryModification[],
  date: Date = new Date()
): TemporaryModification | null {
  const activeModifications = modifications.filter((mod) => isModificationActive(mod, date))
  
  if (activeModifications.length === 0) {
    return null
  }
  
  // Si hay múltiples, retornar la más reciente (por createdAt)
  return activeModifications.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]
}
