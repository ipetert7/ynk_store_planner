#!/usr/bin/env tsx

import { listBackups } from '../src/lib/backup'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

async function main() {
  try {
    console.log('📋 Listando backups disponibles...\n')

    const backupList = await listBackups()

    if (backupList.backups.length === 0) {
      console.log('📭 No hay backups disponibles.')
      return
    }

    console.log(`📊 Total de backups: ${backupList.backups.length}`)
    console.log(`💾 Espacio total usado: ${formatBytes(backupList.totalSize)}`)
    if (backupList.lastBackup) {
      console.log(`🕒 Último backup: ${formatDate(backupList.lastBackup)}`)
    }
    console.log('\n' + '='.repeat(80))

    backupList.backups.forEach((backup, index) => {
      console.log(`${index + 1}. Backup: ${backup.id}`)
      console.log(`   📁 Archivo: ${backup.filename}`)
      console.log(`   📅 Creado: ${formatDate(backup.createdAt)}`)
      console.log(`   📏 Tamaño original: ${formatBytes(backup.size)}`)
      console.log(`   🗜️  Tamaño comprimido: ${formatBytes(backup.compressedSize)}`)
      console.log(`   🔒 Checksum: ${backup.checksum.substring(0, 16)}...`)
      console.log('-'.repeat(40))
    })

    console.log('\n💡 Para restaurar un backup, usa:')
    console.log('   npm run backup:restore <backup-id>')

  } catch (error) {
    console.error('❌ Error listando backups:', error)
    process.exit(1)
  }
}

main()
