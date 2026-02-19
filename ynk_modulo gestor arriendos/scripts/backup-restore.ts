#!/usr/bin/env tsx

import { restoreBackup } from '../src/lib/backup'

async function main() {
  const backupId = process.argv[2]

  if (!backupId) {
    console.error('❌ Error: Debes especificar el ID del backup a restaurar')
    console.log('\n📋 Lista de backups disponibles:')
    console.log('   npm run backup:list')
    console.log('\n💡 Uso:')
    console.log('   npm run backup:restore <backup-id>')
    console.log('\n⚠️  ADVERTENCIA: Esta acción reemplazará la base de datos actual.')
    console.log('   Se creará un backup del estado actual antes de restaurar.')
    process.exit(1)
  }

  try {
    console.log(`🔄 Restaurando backup: ${backupId}`)
    console.log('⚠️  Esta acción reemplazará la base de datos actual.')
    console.log('   Se creará un backup del estado actual...\n')

    // Confirmar acción
    process.stdout.write('¿Estás seguro de que quieres continuar? (escribe "yes" para confirmar): ')
    const stdin = process.stdin
    stdin.setEncoding('utf-8')

    const confirmation = await new Promise<string>((resolve) => {
      stdin.once('data', (data) => {
        resolve(data.toString().trim().toLowerCase())
      })
    })

    if (confirmation !== 'yes') {
      console.log('❌ Operación cancelada.')
      process.exit(0)
    }

    console.log('\n🔄 Iniciando restauración...')

    const restoredBackup = await restoreBackup(backupId)

    console.log('✅ Backup restaurado exitosamente!')
    console.log(`📁 Archivo restaurado: ${restoredBackup.filename}`)
    console.log(`📅 Fecha del backup: ${restoredBackup.createdAt}`)
    console.log(`🔒 Checksum verificado: ${restoredBackup.checksum}`)

    console.log('\n💡 Recomendación:')
    console.log('   Reinicia la aplicación para asegurar que todas las conexiones usen la nueva base de datos.')

  } catch (error) {
    console.error('❌ Error restaurando backup:', error)
    process.exit(1)
  }
}

main()
