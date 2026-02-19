#!/usr/bin/env tsx

import * as XLSX from 'xlsx'
import { COLUMN_MAPPING, mapRowToStoreData, parseExcelDate } from '../src/lib/utils/excel'
import path from 'path'

interface ExcelRow {
  [key: string]: any
}

/**
 * Script de debug para analizar archivos Excel de importación
 */
async function debugExcel(filePath: string) {
  console.log('🔍 Analizando archivo Excel:', filePath)
  console.log('=' .repeat(50))

  try {
    // Leer archivo Excel
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Convertir a JSON
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]

    console.log('📊 Información general:')
    console.log(`   - Hojas disponibles: ${workbook.SheetNames.join(', ')}`)
    console.log(`   - Hoja procesada: ${sheetName}`)
    console.log(`   - Total de filas: ${rows.length}`)
    console.log(`   - Total de columnas: ${headers.length}`)
    console.log('')

    console.log('📋 Columnas encontradas:')
    headers.forEach((header, index) => {
      const mappedTo = COLUMN_MAPPING[header]
      const status = mappedTo ? `✅ → ${mappedTo}` : '❌ No mapeada'

      // Mostrar caracteres especiales si no está mapeada
      if (!mappedTo) {
        const charCodes = Array.from(header).map(char => char.charCodeAt(0))
        console.log(`   ${index + 1}. "${header}" ${status}`)
        console.log(`       Códigos de caracteres: [${charCodes.join(', ')}]`)
      } else {
        console.log(`   ${index + 1}. "${header}" ${status}`)
      }
    })
    console.log('')

    // Verificar columnas de fecha específicamente
    console.log('📅 Análisis de columnas de fecha:')
    const dateColumns = headers.filter(header =>
      COLUMN_MAPPING[header] === 'contractStartDate' || COLUMN_MAPPING[header] === 'contractEndDate'
    )

    if (dateColumns.length === 0) {
      console.log('❌ No se encontraron columnas de fecha')
      console.log('Columnas esperadas:', Object.keys(COLUMN_MAPPING).filter(key =>
        COLUMN_MAPPING[key] === 'contractStartDate' || COLUMN_MAPPING[key] === 'contractEndDate'
      ))
    } else {
      console.log('✅ Columnas de fecha encontradas:', dateColumns)
    }
    console.log('')

    // Analizar las primeras filas para detectar problemas comunes
    console.log('🔍 Análisis de las primeras filas:')
    const sampleRows = rows.slice(0, 2)

    sampleRows.forEach((row, index) => {
      const rowNumber = index + 2 // +2 porque Excel empieza en 1 y tiene headers
      console.log(`   Fila ${rowNumber}:`)

      // Mostrar valores de las columnas críticas
      const criticalFields = ['erpId', 'contractStartDate', 'contractEndDate']
      criticalFields.forEach(fieldName => {
        // Buscar la columna que mapea a este campo
        let columnName: string | undefined
        let actualColumn: string | undefined

        for (const header of headers) {
          if (COLUMN_MAPPING[header] === fieldName) {
            columnName = header
            actualColumn = header
            break
          }
        }

        if (actualColumn) {
          const value = row[actualColumn]
          const status = value !== undefined && value !== null && value !== '' ? '✅' : '❌'
          console.log(`     ${actualColumn} (${fieldName}): "${value}" ${status}`)
        } else {
          console.log(`     ${fieldName}: ❌ Columna no encontrada`)
        }
      })
      console.log('')
    })

    // Probar parseo de fechas con diferentes formatos
    console.log('🧪 Pruebas de parseo de fechas:')
    const testDates = [
      '15/01/2024',
      '01/15/2024',
      '2024-01-15',
      '15-01-2024',
      '15/01/24',
      '01/15/24'
    ]

    testDates.forEach(dateStr => {
      const parsed = parseExcelDate(dateStr)
      const status = parsed && parsed !== '' ? '✅' : '❌'
      console.log(`   "${dateStr}" → "${parsed}" ${status}`)
    })

  } catch (error) {
    console.error('❌ Error al procesar el archivo:', error)
  }
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('📝 Uso: tsx scripts/debug-excel.ts <ruta-al-archivo-excel>')
    console.log('')
    console.log('Ejemplo:')
    console.log('  tsx scripts/debug-excel.ts ./tiendas.xlsx')
    console.log('')
    console.log('Este script analiza tu archivo Excel y muestra:')
    console.log('• Qué columnas se encontraron')
    console.log('• Cómo se están mapeando')
    console.log('• Qué valores tienen las fechas')
    console.log('• Si hay problemas de formato')
    process.exit(1)
  }

  const filePath = path.resolve(args[0])
  await debugExcel(filePath)
}

main()
