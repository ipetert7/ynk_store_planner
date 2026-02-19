#!/usr/bin/env tsx

/**
 * Script para probar la restauración de backups de manera controlada
 */

import { listBackups, restoreBackup, disconnectPrismaConnections } from '../src/lib/backup'

async function testRestoreBackup() {
  console.log('🧪 Probando restauración de backup...\n')

  try {
    // Obtener lista de backups
    const backupList = await listBackups()

    if (backupList.backups.length === 0) {
      console.log('❌ No hay backups disponibles para probar')
      return
    }

    // Usar el backup más antiguo para la prueba
    const testBackup = backupList.backups[backupList.backups.length - 1]
    console.log(`📦 Probando restauración del backup: ${testBackup.filename}`)
    console.log(`📅 Fecha: ${new Date(testBackup.createdAt).toLocaleString('es-ES')}\n`)

    // Desconectar Prisma antes de empezar
    console.log('🔌 Desconectando Prisma...')
    await disconnectPrismaConnections()
    console.log('✅ Prisma desconectado\n')

    // Intentar restaurar
    console.log('🚀 Iniciando restauración...')
    const result = await restoreBackup(testBackup.id)

    console.log('\n✅ ¡Restauración exitosa!')
    console.log(`📋 Backup restaurado: ${result.filename}`)

  } catch (error) {
    console.error('\n❌ Error en restauración:', error)
    console.error('Detalle del error:', error instanceof Error ? error.message : 'Error desconocido')

    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }

    process.exit(1)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testRestoreBackup()
}

export { testRestoreBackup }
