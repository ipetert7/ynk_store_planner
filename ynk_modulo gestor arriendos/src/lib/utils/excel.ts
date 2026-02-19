import { StoreFormData } from '@/types/store'

export interface ExcelRow {
  [key: string]: any
}

export interface ValidationResult {
  validRows: Array<{ row: number; data: StoreFormData }>
  duplicates: Array<{
    row: number
    erpId: string
    excelData: StoreFormData
    existingStore: any
  }>
  errors: Array<{ row: number; error: string }>
}

/**
 * Mapea los nombres de columnas del Excel a los campos del schema
 * Ajusta estos nombres según las columnas de tu archivo Excel
 */
export const COLUMN_MAPPING: Record<string, string> = {
  'ID': 'erpId', // ← ID del ERP (único y requerido)
  'ID ERP': 'erpId', // ← Alternativa común
  'ID Tienda': 'erpId', // ← Otra alternativa
  'Nombre Tienda': 'storeName',
  'Banner': 'banner',
  'Superficie Sala': 'surfaceAreaHall',
  'Superficie Total': 'surfaceAreaTotal',
  'Operador Centro Comercial': 'shoppingCenterOperator',
  'Fecha Inicio Contrato': 'contractStartDate',
  'Fecha Término Contrato': 'contractEndDate', // ← Con espacio especial
  'Fecha Término Contrato': 'contractEndDate', // ← Con espacio especial
  'Duración Contrato': 'contractDuration',
  'VMM': 'minimumMonthlyRent',
  'Porcentaje Arriendo': 'percentageRent',
  'Factor Diciembre': 'decemberFactor',
  'Gastos Comunes': 'commonExpenses',
  'Fondo Promoción': 'promotionFund',
  'Días Notificación': 'notificationPeriodDays',
  'Renovación Automática': 'autoRenewal',
  'Tipo Aumento': 'rentIncreaseType',
  'Tipo Aumento (opcional)': 'rentIncreaseType',
  'Porcentaje Aumento Anual': 'annualRentIncreasePercentage',
  'Porcentaje Aumento Anual (opcional)': 'annualRentIncreasePercentage',
  'Tipo Garantía': 'guaranteeType',
  'Tipo Garantía (opcional)': 'guaranteeType',
  'Monto Garantía': 'guaranteeAmount',
  'Monto Garantía (opcional)': 'guaranteeAmount',
  'Monto Garantía (opcional)': 'guaranteeAmount', // ← Con espacio especial
  'Moneda Garantía': 'guaranteeCurrency',
  'Moneda Garantía (opcional)': 'guaranteeCurrency',
  'Moneda Garantía (opcional)': 'guaranteeCurrency', // ← Con espacio especial
}

/**
 * Convierte una fecha de Excel a formato ISO string
 * Maneja múltiples formatos comunes de fecha
 */
export function parseExcelDate(value: any): string {
  if (!value) return ''

  // Si ya es una fecha de JavaScript
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  // Si es un número (días desde 1900-01-01 en Excel)
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + value * 86400000)
    return date.toISOString().split('T')[0]
  }

  // Si es un string, intentar múltiples formatos
  if (typeof value === 'string') {
    const dateStr = value.trim()

    // Intentar parseo directo primero
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]
    }

    // Intentar formatos comunes de fecha
    const dateFormats = [
      // DD/MM/YYYY o DD-MM-YYYY
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/,
      // MM/DD/YYYY o MM-DD-YYYY
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/,
      // YYYY/MM/DD o YYYY-MM-DD
      /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/,
      // DD/MM/YY o DD-MM-YY (asumiendo 20xx)
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/,
    ]

    for (const format of dateFormats) {
      const match = dateStr.match(format)
      if (match) {
        let year: number | undefined
        let month: number | undefined
        let day: number | undefined

        if (format === dateFormats[0] || format === dateFormats[3]) {
          // Formato DD/MM/YYYY o DD/MM/YY
          day = parseInt(match[1])
          month = parseInt(match[2]) - 1 // Meses en JS son 0-indexed
          year = parseInt(match[3])
          if (year < 100) year += 2000 // Convertir YY a YYYY
        } else if (format === dateFormats[1]) {
          // Formato MM/DD/YYYY
          month = parseInt(match[1]) - 1
          day = parseInt(match[2])
          year = parseInt(match[3])
        } else if (format === dateFormats[2]) {
          // Formato YYYY/MM/DD
          year = parseInt(match[1])
          month = parseInt(match[2]) - 1
          day = parseInt(match[3])
        }

        if (year === undefined || month === undefined || day === undefined) {
          continue
        }

        const date = new Date(year, month, day)
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]
        }
      }
    }

    // Último intento: intentar con el constructor de Date con diferentes formatos
    const alternativeFormats = [
      dateStr.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, '$2/$1/$3'), // DD/MM/YYYY -> MM/DD/YYYY
      dateStr.replace(/(\d{1,2})-(\d{1,2})-(\d{4})/, '$2/$1/$3'), // DD-MM-YYYY -> MM/DD/YYYY
    ]

    for (const format of alternativeFormats) {
      const parsedAlt = new Date(format)
      if (!isNaN(parsedAlt.getTime())) {
        return parsedAlt.toISOString().split('T')[0]
      }
    }
  }

  // Si no se pudo parsear, devolver el valor original como string
  return value.toString()
}

/**
 * Convierte un valor booleano desde Excel
 */
export function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    return lower === 'si' || lower === 'sí' || lower === 'yes' || lower === 'true' || lower === '1'
  }
  if (typeof value === 'number') return value !== 0
  return false
}

/**
 * Normaliza un header para comparación
 */
function normalizeHeader(header: string): string {
  return header.trim().replace(/\s+/g, ' ')
}

/**
 * Encuentra el campo mapeado para un header normalizado
 */
function findMappedField(header: string): string | undefined {
  const normalized = normalizeHeader(header)
  
  // Buscar coincidencia exacta primero
  if (COLUMN_MAPPING[header]) {
    return COLUMN_MAPPING[header]
  }
  
  // Buscar con normalización
  for (const [key, value] of Object.entries(COLUMN_MAPPING)) {
    if (normalizeHeader(key) === normalized) {
      return value
    }
  }
  
  // Buscar coincidencias parciales para campos comunes
  const lowerHeader = normalized.toLowerCase()
  if (lowerHeader.includes('fecha inicio') || lowerHeader.includes('inicio contrato')) {
    return 'contractStartDate'
  }
  if (lowerHeader.includes('fecha término') || lowerHeader.includes('término contrato') || lowerHeader.includes('termino contrato')) {
    return 'contractEndDate'
  }
  if (lowerHeader.includes('id') && (lowerHeader.includes('erp') || lowerHeader.includes('tienda'))) {
    return 'erpId'
  }
  
  return undefined
}

/**
 * Convierte una fila de Excel al formato del schema
 */
export function mapRowToStoreData(row: ExcelRow, headers: string[]): any {
  const mapped: any = {}

  headers.forEach((header, index) => {
    const fieldName = findMappedField(header)
    if (!fieldName) return

    // Intentar obtener el valor de múltiples formas
    // XLSX puede usar el header exacto como clave
    let value = row[header]
    
    // Si no se encuentra, intentar con normalización y variaciones
    if (value === undefined || value === null) {
      const normalizedHeader = normalizeHeader(header)
      // Buscar en todas las claves del row que coincidan
      for (const key in row) {
        if (normalizeHeader(key) === normalizedHeader) {
          value = row[key]
          break
        }
      }
    }
    
    // Si aún no se encuentra, intentar por índice
    if (value === undefined || value === null) {
      value = row[index]
    }

    // Manejar valores vacíos (pero permitir números, incluyendo fechas numéricas de Excel)
    const isEmpty = value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
    const isDateField = fieldName === 'contractStartDate' || fieldName === 'contractEndDate'
    const isNumericDate = isDateField && typeof value === 'number' && value > 0
    
    // Si está vacío y no es una fecha numérica válida
    if (isEmpty && !isNumericDate) {
      // El erpId es requerido, no puede estar vacío
      if (fieldName === 'erpId') {
        throw new Error(`El ID del ERP es requerido pero no se encontró en la fila`)
      }
      // Otros campos opcionales pueden quedarse undefined
      return
    }

    // Manejar erpId específicamente
    if (fieldName === 'erpId') {
      // Convertir a string y limpiar espacios
      mapped[fieldName] = String(value).trim()
      return
    }

    // Conversiones especiales según el tipo de campo
    switch (fieldName) {
      case 'contractStartDate':
      case 'contractEndDate':
        const parsedDate = parseExcelDate(value)
        if (!parsedDate || parsedDate === '') {
          throw new Error(`Fecha inválida para ${fieldName}: "${value}" (tipo: ${typeof value})`)
        }
        // Validar que la fecha parseada sea realmente válida
        const dateObj = new Date(parsedDate)
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Fecha inválida para ${fieldName}: "${value}" → "${parsedDate}" (no se pudo convertir a fecha válida)`)
        }
        mapped[fieldName] = parsedDate
        break

      case 'autoRenewal':
        mapped[fieldName] = parseBoolean(value)
        break

      case 'rentIncreaseType':
        // Mapear valores comunes a los enum
        if (typeof value === 'string') {
          const upper = value.toUpperCase().trim()
          if (upper.includes('ANUAL') || upper.includes('ANNUAL')) {
            mapped[fieldName] = 'ANNUAL'
          } else if (upper.includes('FECHA') || upper.includes('SPECIFIC')) {
            mapped[fieldName] = 'SPECIFIC_DATES'
          }
        }
        break

      case 'guaranteeType':
        if (typeof value === 'string') {
          const upper = value.toUpperCase().trim()
          if (upper.includes('EFECTIVO') || upper.includes('CASH')) {
            mapped[fieldName] = 'CASH'
          } else if (upper.includes('BANCO') || upper.includes('BANK')) {
            mapped[fieldName] = 'BANK_GUARANTEE'
          }
        }
        break

      case 'guaranteeCurrency':
        if (typeof value === 'string') {
          const upper = value.toUpperCase().trim()
          mapped[fieldName] = upper === 'UF' ? 'UF' : 'CLP'
        }
        break

      default:
        // Convertir números
        if (['surfaceAreaHall', 'surfaceAreaTotal', 'minimumMonthlyRent',
             'percentageRent', 'decemberFactor', 'commonExpenses',
             'promotionFund', 'notificationPeriodDays', 'contractDuration',
             'annualRentIncreasePercentage', 'guaranteeAmount'].includes(fieldName)) {
          const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value)
          if (!isNaN(numValue)) {
            mapped[fieldName] = numValue
          }
        } else {
          mapped[fieldName] = value
        }
    }
  })

  // Calcular duración del contrato si no está presente
  if (!mapped.contractDuration && mapped.contractStartDate && mapped.contractEndDate) {
    const startDate = new Date(mapped.contractStartDate)
    const endDate = new Date(mapped.contractEndDate)
    mapped.contractDuration = calculateContractDuration(startDate, endDate)
  }

  // Valores por defecto
  mapped.autoRenewal = mapped.autoRenewal ?? false
  mapped.shoppingCenterOperator = mapped.shoppingCenterOperator ?? ''

  return mapped
}

/**
 * Calcula la duración del contrato en meses
 */
function calculateContractDuration(startDate: Date, endDate: Date): number {
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                 (endDate.getMonth() - startDate.getMonth())
  return months
}

/**
 * Valida y procesa filas de Excel
 */
export function validateExcelRows(rows: ExcelRow[], headers: string[], existingErpIds: Set<string>): ValidationResult {
  const result: ValidationResult = {
    validRows: [],
    duplicates: [],
    errors: [],
  }

  // Verificar que existan las columnas críticas usando la función mejorada
  const hasStartDate = headers.some(header => findMappedField(header) === 'contractStartDate')
  const hasEndDate = headers.some(header => findMappedField(header) === 'contractEndDate')

  if (!hasStartDate || !hasEndDate) {
    // Agregar error general para todas las filas con información más detallada
    const missingColumns: string[] = []
    if (!hasStartDate) missingColumns.push('Fecha Inicio Contrato')
    if (!hasEndDate) missingColumns.push('Fecha Término Contrato')

    rows.forEach((_, index) => {
      result.errors.push({
        row: index + 2, // +2 porque Excel empieza en 1 y tiene headers
        error: `No se encontraron columnas requeridas: ${missingColumns.join(', ')}. Columnas disponibles en el Excel: ${headers.join(', ')}`
      })
    })
    return result
  }

  // Verificar duplicados dentro del Excel
  const excelErpIds = new Map<string, number[]>()

  rows.forEach((row, index) => {
    const erpId = getErpIdFromRow(row, headers)
    if (erpId) {
      const erpIdStr = String(erpId).trim()
      if (!excelErpIds.has(erpIdStr)) {
        excelErpIds.set(erpIdStr, [])
      }
      excelErpIds.get(erpIdStr)!.push(index)
    }
  })

  // Agregar errores para duplicados dentro del Excel
  for (const [erpId, rowIndices] of excelErpIds) {
    if (rowIndices.length > 1) {
      rowIndices.forEach(rowIndex => {
        result.errors.push({
          row: rowIndex + 2, // +2 porque Excel empieza en 1 y tiene headers
          error: `ID del ERP duplicado en el archivo Excel: ${erpId}`
        })
      })
    }
  }

  // Procesar cada fila
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNumber = i + 2 // +2 porque Excel empieza en 1 y tiene headers

    // Saltar filas que ya tienen error de duplicado en Excel
    const hasDuplicateError = result.errors.some(err =>
      err.row === rowNumber && err.error.includes('duplicado en el archivo Excel')
    )
    if (hasDuplicateError) continue

    try {
      // Mapear fila a formato del schema
      const storeData = mapRowToStoreData(row, headers)

      // Verificar si existe en la base de datos
      const erpId = storeData.erpId
      if (existingErpIds.has(erpId)) {
        // Es un duplicado - obtener información de la tienda existente
        // Nota: la tienda existente se obtendrá después en el endpoint
        result.duplicates.push({
          row: rowNumber,
          erpId,
          excelData: storeData as StoreFormData,
          existingStore: null, // Se completará después
        })
      } else {
        // No es duplicado, agregar como fila válida
        result.validRows.push({
          row: rowNumber,
          data: storeData as StoreFormData,
        })
      }

    } catch (error: any) {
      result.errors.push({
        row: rowNumber,
        error: error.errors?.[0]?.message || error.message || 'Error desconocido'
      })
    }
  }

  return result
}

/**
 * Obtiene el ID del ERP de una fila
 */
function getErpIdFromRow(row: ExcelRow, headers: string[]): string | null {
  // Buscar por múltiples variantes de nombres
  const erpIdKeys = ['ID', 'ID ERP', 'ID Tienda', 'id', 'id erp', 'id tienda']
  
  // Primero buscar en los headers normalizados
  for (const header of headers) {
    const normalized = normalizeHeader(header).toLowerCase()
    if (normalized.includes('id') && (normalized.includes('erp') || normalized.includes('tienda'))) {
      const value = row[header] ?? row[normalizeHeader(header)]
      if (value !== undefined && value !== null && value !== '') {
        return String(value).trim()
      }
    }
  }
  
  // Buscar por las claves exactas
  for (const key of erpIdKeys) {
    const value = row[key] || row[normalizeHeader(key)] || row[headers.indexOf(key)]
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim()
    }
  }
  
  return null
}
