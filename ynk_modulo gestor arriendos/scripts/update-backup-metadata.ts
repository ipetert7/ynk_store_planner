#!/usr/bin/env tsx

/**
 * Script para actualizar metadatos de backups existentes
 * Agrega storeCount a backups que no lo tienen
 */

import { readBackupMetadata, saveBackupMetadata } from '../src/lib/backup'

async function updateBackupMetadata() {
  console.log('🔄 Actualizando metadatos de backups existentes...')

  try {
    // Leer metadatos actuales
    const backups = await readBackupMetadata()
    let updatedCount = 0

    // Actualizar backups que no tienen storeCount
    const updatedBackups = backups.map(backup => {
      if (backup.storeCount === undefined) {
        console.log(`📝 Actualizando backup: ${backup.filename}`)
        updatedCount++
        return {
          ...backup,
          storeCount: -1 // -1 indica que el conteo es desconocido
        }
      }
      return backup
    })

    // Guardar metadatos actualizados
    if (updatedCount > 0) {
      await saveBackupMetadata(updatedBackups)
      console.log(`✅ Actualizados ${updatedCount} backups`)
    } else {
      console.log('ℹ️  Todos los backups ya tienen storeCount')
    }

    console.log('🎉 Proceso completado exitosamente')
  } catch (error) {
    console.error('❌ Error actualizando metadatos:', error)
    process.exit(1)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  updateBackupMetadata()
}

export { updateBackupMetadata }
