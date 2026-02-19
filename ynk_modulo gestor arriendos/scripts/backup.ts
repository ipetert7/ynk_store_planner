#!/usr/bin/env tsx

import { createBackup } from '../src/lib/backup'

async function main() {
  try {
    console.log('🚀 Iniciando backup manual...')

    const backup = await createBackup()

    console.log('✅ Backup creado exitosamente!')
    console.log(`📁 Archivo: ${backup.filename}`)
    console.log(`📅 Fecha: ${backup.createdAt}`)
    console.log(`📏 Tamaño original: ${(backup.size / 1024).toFixed(2)} KB`)
    console.log(`🗜️  Tamaño comprimido: ${(backup.compressedSize / 1024).toFixed(2)} KB`)
    console.log(`🔒 Checksum: ${backup.checksum}`)

  } catch (error) {
    console.error('❌ Error creando backup:', error)
    process.exit(1)
  }
}

main()
