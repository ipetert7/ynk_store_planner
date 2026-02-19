#!/usr/bin/env tsx

/**
 * Script para diagnosticar problemas con backups
 */

import { promises as fs } from 'fs'
import { listBackups, getDatabasePath, verifyBackupIntegrity, decompressBackup, disconnectPrismaConnections } from '../src/lib/backup'

async function diagnoseBackups() {
  console.log('🔍 Diagnosticando problemas con backups...\n')

  try {
    // Obtener lista de backups
    const backupList = await listBackups()
    console.log(`📋 Encontrados ${backupList.backups.length} backups:\n`)

    for (const backup of backupList.backups) {
      console.log(`🔍 Analizando backup: ${backup.filename}`)
      console.log(`   📅 Fecha: ${new Date(backup.createdAt).toLocaleString('es-ES')}`)
      console.log(`   📏 Tamaño: ${backup.size} bytes (comprimido: ${backup.compressedSize} bytes)`)

      // Verificar que el archivo existe
      try {
        await fs.access(backup.path)
        console.log(`   ✅ Archivo existe: ${backup.path}`)
      } catch {
        console.log(`   ❌ Archivo NO existe: ${backup.path}`)
        continue
      }

      // Verificar checksum
      try {
        const isValid = await verifyBackupIntegrity(backup.path, backup.checksum)
        console.log(`   ${isValid ? '✅' : '❌'} Checksum ${isValid ? 'válido' : 'inválido'}`)
      } catch (error) {
        console.log(`   ❌ Error verificando checksum: ${error instanceof Error ? error.message : 'Error desconocido'}`)
        continue
      }

      // Intentar descomprimir para verificar contenido
      try {
        const dbPath = getDatabasePath()
        const tempPath = `${dbPath}.test-${Date.now()}.db`

        await decompressBackup(backup.path, tempPath)

        // Verificar que el archivo descomprimido tiene contenido
        const stats = await fs.stat(tempPath)
        console.log(`   ✅ Descompresión exitosa, tamaño: ${stats.size} bytes`)

        // Limpiar archivo temporal
        await fs.unlink(tempPath)
      } catch (error) {
        console.log(`   ❌ Error en descompresión: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      }

      console.log('') // Línea en blanco entre backups
    }

    // Verificar base de datos actual
    const dbPath = getDatabasePath()
    console.log('🏗️  Información de la base de datos actual:')
    try {
      const stats = await fs.stat(dbPath)
      console.log(`   📍 Ruta: ${dbPath}`)
      console.log(`   📏 Tamaño: ${stats.size} bytes`)
      console.log(`   📅 Modificado: ${stats.mtime.toLocaleString('es-ES')}`)
    } catch (error) {
      console.log(`   ❌ Error accediendo a la base de datos: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }

    console.log('\n🎉 Diagnóstico completado')

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error)
    process.exit(1)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  diagnoseBackups()
}

export { diagnoseBackups }
