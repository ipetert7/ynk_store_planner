#!/usr/bin/env tsx

/**
 * Script que simula exactamente lo que hace el endpoint de validación
 */

import * as XLSX from 'xlsx'
import { promises as fs } from 'fs'
import { validateExcelRows } from '../src/lib/utils/excel'
import { prisma } from '../src/lib/prisma'

async function testEndpointValidation() {
  console.log('🧪 Simulando endpoint de validación de Excel\n')

  try {
    const filePath = 'import/Base arriendos.xlsx'
    
    // Leer archivo como lo haría el endpoint
    console.log('📂 Leyendo archivo...')
    const fileBuffer = await fs.readFile(filePath)
    console.log(`✅ Archivo leído: ${fileBuffer.length} bytes\n`)

    // Leer como lo haría el endpoint (desde ArrayBuffer)
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    )
    const buffer = Buffer.from(arrayBuffer)

    console.log('📊 Procesando Excel...')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Convertir a JSON exactamente como lo hace el endpoint
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet)
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]

    console.log(`✅ Excel procesado:`)
    console.log(`   - Hoja: ${sheetName}`)
    console.log(`   - Filas: ${rows.length}`)
    console.log(`   - Columnas: ${headers.length}`)
    console.log(`   - Headers: ${headers.slice(0, 5).join(', ')}...\n`)

    if (rows.length === 0) {
      console.log('❌ El archivo Excel no contiene datos')
      return
    }

    // Obtener IDs de ERP existentes
    console.log('🔍 Obteniendo tiendas existentes...')
    const existingStores = await prisma.store.findMany({
      select: { erpId: true, id: true, storeName: true, banner: true }
    })
    const existingErpIds = new Set(
      existingStores.map(store => store.erpId).filter((erpId): erpId is string => erpId !== null)
    )
    console.log(`✅ Tiendas existentes: ${existingErpIds.size}\n`)

    // Validar filas del Excel
    console.log('🔍 Validando filas...')
    try {
      const validationResult = validateExcelRows(rows, headers, existingErpIds)
      
      console.log(`✅ Validación completada:`)
      console.log(`   - Filas válidas: ${validationResult.validRows.length}`)
      console.log(`   - Duplicados: ${validationResult.duplicates.length}`)
      console.log(`   - Errores: ${validationResult.errors.length}\n`)

      if (validationResult.errors.length > 0) {
        console.log('❌ Errores encontrados:')
        validationResult.errors.slice(0, 10).forEach(err => {
          console.log(`   Fila ${err.row}: ${err.error}`)
        })
        if (validationResult.errors.length > 10) {
          console.log(`   ... y ${validationResult.errors.length - 10} errores más`)
        }
      } else {
        console.log('✅ No se encontraron errores')
      }

      // Mostrar ejemplo de fila válida
      if (validationResult.validRows.length > 0) {
        console.log('\n📋 Ejemplo de fila válida:')
        const example = validationResult.validRows[0]
        console.log(`   Fila ${example.row}:`)
        console.log(`   - erpId: ${example.data.erpId}`)
        console.log(`   - storeName: ${example.data.storeName}`)
        console.log(`   - contractStartDate: ${example.data.contractStartDate}`)
        console.log(`   - contractEndDate: ${example.data.contractEndDate}`)
      }

    } catch (validationError: any) {
      console.error('❌ Error durante la validación:')
      console.error(`   Mensaje: ${validationError.message}`)
      console.error(`   Stack: ${validationError.stack}`)
      
      // Mostrar información de la primera fila que causó el error
      if (rows.length > 0) {
        console.log('\n📋 Información de la primera fila:')
        console.log(JSON.stringify(rows[0], null, 2))
        console.log('\n📋 Headers:')
        console.log(JSON.stringify(headers, null, 2))
      }
      
      throw validationError
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

testEndpointValidation()

