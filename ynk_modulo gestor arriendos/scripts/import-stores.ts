#!/usr/bin/env tsx

import * as XLSX from 'xlsx'
import { prisma } from '../src/lib/prisma'
import { storeFormSchema } from '../src/lib/validations/store'
import { calculateContractDuration } from '../src/lib/utils'
import { StoreStatus, AuditAction } from '../src/types/store'
import path from 'path'
import fs from 'fs'

interface ExcelRow {
  [key: string]: any
}

interface ImportResult {
  success: number
  failed: number
  errors: Array<{ row: number; error: string; data: any }>
}

/**
 * Mapea los nombres de columnas del Excel a los campos del schema
 * Ajusta estos nombres según las columnas de tu archivo Excel
 */
const COLUMN_MAPPING: Record<string, string> = {
  'ID': 'erpId', // ← ID del ERP (único y requerido)
  'ID ERP': 'erpId', // ← Alternativa común
  'ID Tienda': 'erpId', // ← Otra alternativa
  'Nombre Tienda': 'storeName',
  'Banner': 'banner',
  'Superficie Sala': 'surfaceAreaHall',
  'Superficie Total': 'surfaceAreaTotal',
  'Operador Centro Comercial': 'shoppingCenterOperator',
  'Fecha Inicio Contrato': 'contractStartDate',
  'Fecha Término Contrato': 'contractEndDate',
  'Duración Contrato': 'contractDuration',
  'VMM': 'minimumMonthlyRent',
  'Porcentaje Arriendo': 'percentageRent',
  'Factor Diciembre': 'decemberFactor',
  'Gastos Comunes': 'commonExpenses',
  'Fondo Promoción': 'promotionFund',
  'Días Notificación': 'notificationPeriodDays',
  'Renovación Automática': 'autoRenewal',
  'Tipo Aumento': 'rentIncreaseType',
  'Porcentaje Aumento Anual': 'annualRentIncreasePercentage',
  'Tipo Garantía': 'guaranteeType',
  'Monto Garantía': 'guaranteeAmount',
  'Moneda Garantía': 'guaranteeCurrency',
}

/**
 * Convierte una fecha de Excel a formato ISO string
 */
function parseExcelDate(value: any): string {
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

  // Si es un string, intentar parsearlo
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]
    }
  }

  return value.toString()
}

/**
 * Convierte un valor booleano desde Excel
 */
function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    return lower === 'si' || lower === 'sí' || lower === 'yes' || lower === 'true' || lower === '1'
  }
  if (typeof value === 'number') return value !== 0
  return false
}

/**
 * Convierte una fila de Excel al formato del schema
 */
function mapRowToStoreData(row: ExcelRow, headers: string[]): any {
  const mapped: any = {}

  headers.forEach((header, index) => {
    const fieldName = COLUMN_MAPPING[header]
    if (!fieldName) return

    let value = row[header] ?? row[index]

    // Manejar valores vacíos
    if (value === null || value === undefined || value === '') {
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
        mapped[fieldName] = parseExcelDate(value)
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
 * Importa tiendas desde un archivo Excel
 */
async function importStores(filePath: string, userId?: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: [],
  }

  // Leer archivo Excel
  console.log(`📖 Leyendo archivo: ${filePath}`)
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  // Convertir a JSON
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)
  const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]

  console.log(`📊 Encontradas ${rows.length} filas de datos`)
  console.log(`📋 Columnas detectadas: ${headers.join(', ')}`)

  if (rows.length === 0) {
    console.log('⚠️  No se encontraron datos en el archivo')
    return result
  }

  // Obtener usuario para auditoría
  let auditUserId = userId
  if (!auditUserId) {
    const firstUser = await prisma.user.findFirst()
    if (!firstUser) {
      throw new Error('No se encontró ningún usuario en la base de datos. Necesitas crear al menos un usuario primero.')
    }
    auditUserId = firstUser.id
    console.log(`👤 Usando usuario para auditoría: ${firstUser.email}`)
  }

  // Verificar erpIds duplicados en el Excel
  const excelErpIds = new Set<string>()
  const duplicatedErpIds: string[] = []

  rows.forEach((row, index) => {
    const erpId = row['ID'] || row['ID ERP'] || row['ID Tienda'] || row[headers.indexOf('ID')] || row[headers.indexOf('ID ERP')] || row[headers.indexOf('ID Tienda')]
    if (erpId) {
      const erpIdStr = String(erpId).trim()
      if (excelErpIds.has(erpIdStr)) {
        duplicatedErpIds.push(erpIdStr)
      }
      excelErpIds.add(erpIdStr)
    }
  })

  if (duplicatedErpIds.length > 0) {
    console.log(`❌ Error: Se encontraron IDs del ERP duplicados en el Excel: ${duplicatedErpIds.join(', ')}`)
    console.log('Cada tienda debe tener un ID único del ERP.')
    process.exit(1)
  }

  // Verificar que no haya erpIds vacíos
  const emptyErpIds: number[] = []
  rows.forEach((row, index) => {
    const erpId = row['ID'] || row['ID ERP'] || row['ID Tienda'] || row[headers.indexOf('ID')] || row[headers.indexOf('ID ERP')] || row[headers.indexOf('ID Tienda')]
    if (!erpId || String(erpId).trim() === '') {
      emptyErpIds.push(index + 2) // +2 porque Excel empieza en 1 y tiene headers
    }
  })

  if (emptyErpIds.length > 0) {
    console.log(`❌ Error: Se encontraron filas sin ID del ERP: ${emptyErpIds.join(', ')}`)
    console.log('El ID del ERP es obligatorio para todas las tiendas.')
    process.exit(1)
  }

  // Procesar cada fila
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNumber = i + 2 // +2 porque Excel empieza en 1 y tiene headers

    try {
      // Mapear fila a formato del schema
      const storeData = mapRowToStoreData(row, headers)

      // Validar con Zod
      const validatedData = storeFormSchema.parse(storeData)

      // Verificar que el erpId no exista en la base de datos
      const existingStore = await prisma.store.findUnique({
        where: { erpId: validatedData.erpId },
      })

      if (existingStore) {
        throw new Error(`Ya existe una tienda con el ID del ERP: ${validatedData.erpId}`)
      }

      // Preparar datos para Prisma
      const startDate = new Date(validatedData.contractStartDate)
      const endDate = new Date(validatedData.contractEndDate)
      const contractDuration = calculateContractDuration(startDate, endDate)

      // Crear tienda en transacción
      await prisma.$transaction(async (tx) => {
        const store = await tx.store.create({
          data: {
            erpId: validatedData.erpId,
            storeName: validatedData.storeName,
            banner: validatedData.banner,
            surfaceAreaHall: validatedData.surfaceAreaHall || 0,
            surfaceAreaTotal: validatedData.surfaceAreaTotal || 0,
            shoppingCenterOperator: validatedData.shoppingCenterOperator ?? '',
            contractStartDate: startDate,
            contractEndDate: endDate,
            contractDuration,
            minimumMonthlyRent: validatedData.minimumMonthlyRent || 0,
            percentageRent: validatedData.percentageRent || 0,
            decemberFactor: validatedData.decemberFactor ?? 1,
            commonExpenses: validatedData.commonExpenses || 0,
            promotionFund: validatedData.promotionFund || 0,
            notificationPeriodDays: validatedData.notificationPeriodDays || 0,
            status: StoreStatus.ACTIVE,
            autoRenewal: validatedData.autoRenewal || false,
            rentIncreaseType: validatedData.rentIncreaseType ?? null,
            annualRentIncreasePercentage: validatedData.annualRentIncreasePercentage ?? null,
            guaranteeType: validatedData.guaranteeType ?? null,
            guaranteeAmount: validatedData.guaranteeAmount ?? null,
            guaranteeCurrency: validatedData.guaranteeCurrency ?? null,
          },
        })

        // Crear fechas de aumento específicas si existen
        if (validatedData.rentIncreaseDates && validatedData.rentIncreaseDates.length > 0) {
          await tx.rentIncreaseDate.createMany({
            data: validatedData.rentIncreaseDates.map((date) => ({
              storeId: store.id,
              increaseDate: new Date(date.increaseDate),
              increasePercentage: date.increasePercentage || 0,
            })),
          })
        }

        // Registrar en audit log
        await tx.auditLog.create({
          data: {
            userId: auditUserId!,
            storeId: store.id,
            action: AuditAction.CREATE,
            fieldChanged: null,
            oldValue: null,
            newValue: null,
          },
        })
      })

      result.success++
      if (result.success % 10 === 0) {
        console.log(`✅ Procesadas ${result.success} tiendas exitosamente...`)
      }

    } catch (error: any) {
      result.failed++
      const errorMessage = error.errors?.[0]?.message || error.message || 'Error desconocido'
      result.errors.push({
        row: rowNumber,
        error: errorMessage,
        data: row,
      })
      console.error(`❌ Error en fila ${rowNumber}: ${errorMessage}`)
    }
  }

  return result
}

/**
 * Función principal
 */
async function main() {
  try {
    const args = process.argv.slice(2)

    if (args.length === 0) {
      console.log('📝 Uso: tsx scripts/import-stores.ts <ruta-al-archivo-excel> [userId]')
      console.log('')
      console.log('Ejemplo:')
      console.log('  tsx scripts/import-stores.ts ./tiendas.xlsx')
      console.log('')
      console.log('El script buscará el archivo Excel y lo importará a la base de datos.')
      console.log('Asegúrate de que el archivo tenga una columna con el ID del ERP (ID, ID ERP, o ID Tienda).')
      process.exit(1)
    }

    const filePath = path.resolve(args[0])
    const userId = args[1]

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: El archivo ${filePath} no existe`)
      process.exit(1)
    }

    console.log('🚀 Iniciando importación de tiendas...')
    console.log('')

    const result = await importStores(filePath, userId)

    console.log('')
    console.log('='.repeat(50))
    console.log('📊 Resumen de importación:')
    console.log(`✅ Tiendas importadas exitosamente: ${result.success}`)
    console.log(`❌ Tiendas con errores: ${result.failed}`)
    console.log('')

    if (result.errors.length > 0) {
      console.log('⚠️  Errores encontrados:')
      result.errors.slice(0, 10).forEach((err) => {
        console.log(`   Fila ${err.row}: ${err.error}`)
      })
      if (result.errors.length > 10) {
        console.log(`   ... y ${result.errors.length - 10} errores más`)
      }
    }

    console.log('='.repeat(50))

    if (result.success > 0) {
      console.log('✅ Importación completada!')
    } else {
      console.log('❌ No se importó ninguna tienda. Revisa los errores arriba.')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Error durante la importación:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
