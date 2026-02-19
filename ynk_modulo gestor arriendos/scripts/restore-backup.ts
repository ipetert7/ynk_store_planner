#!/usr/bin/env tsx

/**
 * Script para restaurar backups de manera segura
 * Verifica que la aplicación no esté ejecutándose antes de proceder
 */

import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { listBackups, restoreBackup } from '../src/lib/backup'

async function isAppRunning(): Promise<boolean> {
  try {
    const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
      const child = spawn('pgrep', ['-f', 'next dev'], { stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => { stdout += data.toString() })
      child.stderr.on('data', (data) => { stderr += data.toString() })

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout })
        } else {
          resolve({ stdout: '' })
        }
      })

      child.on('error', reject)
    })

    return stdout.trim().length > 0
  } catch {
    return false
  }
}

async function restoreBackupInteractive() {
  console.log('🔄 Herramienta de restauración de backups\n')

  // Verificar si la aplicación está ejecutándose
  console.log('🔍 Verificando si la aplicación está ejecutándose...')
  const appRunning = await isAppRunning()

  if (appRunning) {
    console.log('⚠️  La aplicación Next.js está ejecutándose.')
    console.log('❌ Para evitar errores, detenga la aplicación primero ejecutando: npm run dev (y presione Ctrl+C)')
    console.log('💡 O use este script desde otra terminal mientras la aplicación está detenida.\n')
    process.exit(1)
  }

  console.log('✅ La aplicación no está ejecutándose. Procediendo...\n')

  // Obtener lista de backups
  const backupList = await listBackups()

  if (backupList.backups.length === 0) {
    console.log('❌ No hay backups disponibles para restaurar')
    return
  }

  console.log('📋 Backups disponibles:')
  backupList.backups.forEach((backup, index) => {
    const date = new Date(backup.createdAt).toLocaleString('es-ES')
    const storesText = backup.storeCount !== undefined
      ? backup.storeCount === -1
        ? 'Desconocido'
        : `${backup.storeCount} tiendas`
      : 'N/A'

    console.log(`  ${index + 1}. ${backup.filename}`)
    console.log(`     📅 ${date}`)
    console.log(`     🏪 ${storesText}`)
    console.log(`     📏 ${(backup.compressedSize / 1024).toFixed(2)} KB`)
    console.log('')
  })

  // Solicitar selección de backup
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve)
    })
  }

  try {
    const selection = await question('Seleccione el número del backup a restaurar: ')
    const backupIndex = parseInt(selection) - 1

    if (isNaN(backupIndex) || backupIndex < 0 || backupIndex >= backupList.backups.length) {
      console.log('❌ Selección inválida')
      rl.close()
      return
    }

    const selectedBackup = backupList.backups[backupIndex]

    // Confirmación final
    console.log(`\n🎯 Backup seleccionado: ${selectedBackup.filename}`)
    console.log(`📅 Fecha: ${new Date(selectedBackup.createdAt).toLocaleString('es-ES')}`)

    const confirm = await question('\n⚠️  ¿Está seguro de que quiere restaurar este backup? (escriba "SI" para confirmar): ')

    if (confirm.toUpperCase() !== 'SI') {
      console.log('❌ Restauración cancelada')
      rl.close()
      return
    }

    rl.close()

    console.log('\n🚀 Iniciando restauración...')
    const result = await restoreBackup(selectedBackup.id)

    console.log('\n✅ ¡Restauración completada exitosamente!')
    console.log(`📋 Backup restaurado: ${result.filename}`)

    console.log('\n💡 Ahora puede reiniciar la aplicación con: npm run dev')

  } catch (error) {
    console.error('\n❌ Error durante la restauración:', error)
    rl.close()
    process.exit(1)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  restoreBackupInteractive()
}

export { restoreBackupInteractive }
