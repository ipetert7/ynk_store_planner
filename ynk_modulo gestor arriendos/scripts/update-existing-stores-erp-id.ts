#!/usr/bin/env tsx

import { prisma } from '../src/lib/prisma'
import { AuditAction } from '../src/types/store'

/**
 * Actualiza el erpId de tiendas existentes que no tienen uno asignado
 */
async function updateExistingStoresErpIds(updates: Array<{ storeId: string; erpId: string }>, userId?: string): Promise<void> {
  // Obtener usuario para auditoría
  let auditUserId = userId
  if (!auditUserId) {
    const firstUser = await prisma.user.findFirst()
    if (!firstUser) {
      throw new Error('No se encontró ningún usuario en la base de datos. Necesitas crear al menos un usuario primero.')
    }
    auditUserId = firstUser.id
  }

  console.log(`👤 Usando usuario para auditoría: ID ${auditUserId}`)

  let successCount = 0
  let errorCount = 0

  for (const update of updates) {
    try {
      // Verificar que la tienda existe
      const store = await prisma.store.findUnique({
        where: { id: update.storeId },
      })

      if (!store) {
        console.error(`❌ Tienda con ID ${update.storeId} no encontrada`)
        errorCount++
        continue
      }

      // Verificar que la tienda no tenga ya un erpId
      if (store.erpId) {
        console.error(`❌ La tienda ${store.storeName} (ID: ${update.storeId}) ya tiene un erpId asignado: ${store.erpId}`)
        errorCount++
        continue
      }

      // Verificar que el erpId no esté en uso
      const existingStore = await prisma.store.findUnique({
        where: { erpId: update.erpId },
      })

      if (existingStore) {
        console.error(`❌ El erpId ${update.erpId} ya está en uso por la tienda: ${existingStore.storeName}`)
        errorCount++
        continue
      }

      // Actualizar la tienda
      await prisma.store.update({
        where: { id: update.storeId },
        data: { erpId: update.erpId },
      })

      // Registrar en audit log
      await prisma.auditLog.create({
        data: {
          userId: auditUserId,
          storeId: update.storeId,
          action: AuditAction.UPDATE,
          fieldChanged: 'erpId',
          oldValue: null,
          newValue: update.erpId,
        },
      })

      console.log(`✅ Actualizada tienda: ${store.storeName} -> erpId: ${update.erpId}`)
      successCount++

    } catch (error) {
      console.error(`❌ Error actualizando tienda ${update.storeId}:`, error)
      errorCount++
    }
  }

  console.log(`\n📊 Resumen:`)
  console.log(`✅ Tiendas actualizadas exitosamente: ${successCount}`)
  console.log(`❌ Errores: ${errorCount}`)
}

/**
 * Lista todas las tiendas sin erpId asignado
 */
async function listStoresWithoutErpId(): Promise<void> {
  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { erpId: null },
        { erpId: '' }
      ]
    },
    select: {
      id: true,
      storeName: true,
      banner: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (stores.length === 0) {
    console.log('✅ Todas las tiendas tienen erpId asignado')
    return
  }

  console.log(`📋 Tiendas sin erpId asignado (${stores.length}):`)
  console.log('─'.repeat(80))
  console.log('ID'.padEnd(40), 'Nombre'.padEnd(25), 'Estado'.padEnd(10), 'Creada')
  console.log('─'.repeat(80))

  stores.forEach(store => {
    const createdDate = store.createdAt.toLocaleDateString('es-CL')
    console.log(
      store.id.padEnd(40),
      store.storeName.substring(0, 24).padEnd(25),
      store.status.padEnd(10),
      createdDate
    )
  })

  console.log('─'.repeat(80))
  console.log('\n💡 Para asignar erpId, usa el comando con un archivo JSON o parámetros directos.')
}

/**
 * Función principal
 */
async function main() {
  try {
    const args = process.argv.slice(2)

    if (args.length === 0) {
      console.log('📝 Uso del script:')
      console.log('')
      console.log('1. Listar tiendas sin erpId:')
      console.log('   tsx scripts/update-existing-stores-erp-id.ts --list')
      console.log('')
      console.log('2. Actualizar desde archivo JSON:')
      console.log('   tsx scripts/update-existing-stores-erp-id.ts --file updates.json [userId]')
      console.log('')
      console.log('3. Actualizar una tienda específica:')
      console.log('   tsx scripts/update-existing-stores-erp-id.ts --single <storeId> <erpId> [userId]')
      console.log('')
      console.log('Formato del archivo JSON:')
      console.log('[')
      console.log('  { "storeId": "uuid-de-la-tienda", "erpId": "ID_DEL_ERP" },')
      console.log('  { "storeId": "uuid-de-la-tienda-2", "erpId": "ID_DEL_ERP_2" }')
      console.log(']')
      console.log('')
      console.log('Ejemplos:')
      console.log('  tsx scripts/update-existing-stores-erp-id.ts --list')
      console.log('  tsx scripts/update-existing-stores-erp-id.ts --file mis-updates.json')
      console.log('  tsx scripts/update-existing-stores-erp-id.ts --single abc123-def456 TIENDA-001')
      process.exit(0)
    }

    const command = args[0]
    const userId = args.length > 2 ? args[2] : undefined

    switch (command) {
      case '--list':
        await listStoresWithoutErpId()
        break

      case '--file':
        if (args.length < 2) {
          console.error('❌ Debes especificar la ruta al archivo JSON')
          process.exit(1)
        }

        const filePath = args[1]
        const fs = require('fs')

        if (!fs.existsSync(filePath)) {
          console.error(`❌ El archivo ${filePath} no existe`)
          process.exit(1)
        }

        const fileContent = fs.readFileSync(filePath, 'utf8')
        const updates = JSON.parse(fileContent)

        if (!Array.isArray(updates)) {
          console.error('❌ El archivo debe contener un array de objetos')
          process.exit(1)
        }

        console.log(`📖 Leyendo actualizaciones desde: ${filePath}`)
        await updateExistingStoresErpIds(updates, userId)
        break

      case '--single':
        if (args.length < 3) {
          console.error('❌ Debes especificar storeId y erpId')
          process.exit(1)
        }

        const storeId = args[1]
        const erpId = args[2]

        await updateExistingStoresErpIds([{ storeId, erpId }], userId)
        break

      default:
        console.error(`❌ Comando desconocido: ${command}`)
        console.log('Usa --list, --file o --single')
        process.exit(1)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
