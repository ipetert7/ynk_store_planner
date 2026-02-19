#!/usr/bin/env tsx

/**
 * Script que simula completamente el proceso de importación
 * Incluyendo autenticación y validación
 */

import * as XLSX from 'xlsx'
import { promises as fs } from 'fs'
import { validateExcelRows } from '../src/lib/utils/excel'
import { prisma } from '../src/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../src/lib/auth'

async function testFullImport() {
  console.log('🧪 Simulando proceso completo de importación\n')

  try {
    const filePath = 'import/Base arriendos.xlsx'
    
    // Leer archivo
    console.log('📂 Leyendo archivo...')
    const fileBuffer = await fs.readFile(filePath)
    const fileStats = await fs.stat(filePath)
    console.log(`✅ Archivo leído: ${fileStats.size} bytes\n`)

    // Simular File object
    const fileName = 'Base arriendos.xlsx'
    const fileType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    // Validar tipo MIME
    const ALLOWED_MIME_TYPES = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    const isValidExtension = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(fileType) || 
                           fileType === '' || 
                           fileType === 'application/octet-stream'

    if (!isValidMimeType && !isValidExtension) {
      throw new Error(`Tipo de archivo no permitido: ${fileType}`)
    }
    console.log(`✅ Tipo de archivo válido: ${fileType}\n`)

    // Validar tamaño (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (fileStats.size > MAX_FILE_SIZE) {
      throw new Error(`Archivo demasiado grande: ${fileStats.size} bytes`)
    }
    console.log(`✅ Tamaño válido: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB\n`)

    // Leer Excel
    console.log('📊 Procesando Excel...')
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    )
    const buffer = Buffer.from(arrayBuffer)

    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    const rows: any[] = XLSX.utils.sheet_to_json(worksheet)
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]

    console.log(`✅ Excel procesado:`)
    console.log(`   - Hoja: ${sheetName}`)
    console.log(`   - Filas: ${rows.length}`)
    console.log(`   - Columnas: ${headers.length}`)
    console.log(`   - Headers: ${headers.join(', ')}\n`)

    if (rows.length === 0) {
      throw new Error('El archivo Excel no contiene datos')
    }

    // Obtener tiendas existentes
    console.log('🔍 Obteniendo tiendas existentes...')
    const existingStores = await prisma.store.findMany({
      select: { erpId: true, id: true, storeName: true, banner: true }
    })
    const existingErpIds = new Set(
      existingStores.map(store => store.erpId).filter((erpId): erpId is string => erpId !== null)
    )
    console.log(`✅ Tiendas existentes en BD: ${existingErpIds.size}\n`)

    // Validar filas
    console.log('🔍 Validando filas del Excel...')
    let validationResult
    try {
      validationResult = validateExcelRows(rows, headers, existingErpIds)
      console.log(`✅ Validación completada:`)
      console.log(`   - Filas válidas: ${validationResult.validRows.length}`)
      console.log(`   - Duplicados: ${validationResult.duplicates.length}`)
      console.log(`   - Errores: ${validationResult.errors.length}\n`)
    } catch (validationError: any) {
      console.error('❌ Error durante validación:')
      console.error(`   Mensaje: ${validationError.message}`)
      console.error(`   Stack: ${validationError.stack}`)
      
      // Mostrar información de debug
      if (rows.length > 0) {
        console.log('\n📋 Primera fila del Excel:')
        console.log(JSON.stringify(rows[0], null, 2))
        console.log('\n📋 Headers:')
        console.log(JSON.stringify(headers, null, 2))
      }
      
      throw validationError
    }

    // Mostrar errores si los hay
    if (validationResult.errors.length > 0) {
      console.log('❌ Errores encontrados:')
      validationResult.errors.slice(0, 10).forEach(err => {
        console.log(`   Fila ${err.row}: ${err.error}`)
      })
      if (validationResult.errors.length > 10) {
        console.log(`   ... y ${validationResult.errors.length - 10} errores más`)
      }
      console.log('')
    }

    // Mostrar duplicados si los hay
    if (validationResult.duplicates.length > 0) {
      console.log('⚠️  Duplicados encontrados:')
      validationResult.duplicates.slice(0, 5).forEach(dup => {
        console.log(`   Fila ${dup.row}: ERP ID ${dup.erpId} ya existe`)
      })
      if (validationResult.duplicates.length > 5) {
        console.log(`   ... y ${validationResult.duplicates.length - 5} duplicados más`)
      }
      console.log('')
    }

    // Mostrar ejemplo de fila válida
    if (validationResult.validRows.length > 0) {
      console.log('✅ Ejemplo de fila válida:')
      const example = validationResult.validRows[0]
      console.log(`   Fila ${example.row}:`)
      console.log(`   - erpId: ${example.data.erpId}`)
      console.log(`   - storeName: ${example.data.storeName}`)
      console.log(`   - banner: ${example.data.banner}`)
      console.log(`   - contractStartDate: ${example.data.contractStartDate}`)
      console.log(`   - contractEndDate: ${example.data.contractEndDate}`)
      console.log(`   - minimumMonthlyRent: ${example.data.minimumMonthlyRent}`)
      console.log('')
    }

    // Resumen final
    console.log('📊 Resumen final:')
    console.log(`   Total de filas: ${rows.length}`)
    console.log(`   Filas válidas: ${validationResult.validRows.length}`)
    console.log(`   Duplicados: ${validationResult.duplicates.length}`)
    console.log(`   Errores: ${validationResult.errors.length}`)
    
    if (validationResult.errors.length === 0 && validationResult.validRows.length > 0) {
      console.log('\n✅ ¡La importación debería funcionar correctamente!')
      console.log(`   Se pueden importar ${validationResult.validRows.length} tiendas`)
    } else if (validationResult.errors.length > 0) {
      console.log('\n❌ Hay errores que deben corregirse antes de importar')
    }

    await prisma.$disconnect()

  } catch (error) {
    console.error('\n❌ Error general:', error)
    if (error instanceof Error) {
      console.error(`   Mensaje: ${error.message}`)
      console.error(`   Stack: ${error.stack}`)
    }
    await prisma.$disconnect()
    process.exit(1)
  }
}

testFullImport()
