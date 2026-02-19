#!/usr/bin/env tsx

/**
 * Script para resetear la base de datos de desarrollo
 * Borra la base de datos actual y la recrea desde cero
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

async function resetDatabase() {
  const projectRoot = process.cwd()
  const dbPath = join(projectRoot, 'prisma', 'dev.db')

  console.log('🔄 Reseteando base de datos de desarrollo...\n')
  console.log(`📁 Directorio del proyecto: ${projectRoot}`)
  console.log(`📍 Ruta de base de datos: ${dbPath}`)
  console.log(`🔗 DATABASE_URL: ${process.env.DATABASE_URL}\n`)

  // Verificar que estamos en el directorio correcto
  try {
    await fs.access(join(projectRoot, 'package.json'))
    await fs.access(join(projectRoot, 'prisma', 'schema.prisma'))
  } catch {
    throw new Error('No se encuentra en el directorio raíz del proyecto. Ejecuta desde la raíz del proyecto.')
  }

  try {
    // Verificar que existe la base de datos
    try {
      await fs.access(dbPath)
      console.log('✅ Base de datos encontrada:', dbPath)
    } catch {
      console.log('ℹ️  La base de datos no existe, creando nueva...')
    }

    // Detener cualquier conexión a la base de datos (si la app está ejecutándose)
    console.log('🔌 Cerrando conexiones activas...')

    // Borrar la base de datos (y cualquier otra que pueda existir)
    const possibleDbPaths = [
      dbPath,
      join(projectRoot, 'prisma', 'prisma', 'dev.db'), // Por si existe en lugar incorrecto
      join(projectRoot, 'dev.db') // Por si existe en la raíz
    ]

    for (const path of possibleDbPaths) {
      try {
        await fs.access(path)
        await fs.unlink(path)
        console.log(`✅ Base de datos borrada: ${path}`)
      } catch {
        // Ignorar si no existe
      }
    }

    // Ejecutar migraciones para recrear la estructura
    console.log('🏗️  Ejecutando migraciones...')
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: process.cwd()
    })

    // Generar cliente Prisma
    console.log('🔧 Generando cliente Prisma...')
    execSync('npx prisma generate', {
      stdio: 'inherit',
      cwd: process.cwd()
    })

    // Crear usuario inicial
    console.log('👤 Creando usuario inicial...')
    execSync('npm run create-user', {
      stdio: 'inherit',
      cwd: process.cwd()
    })

    console.log('\n🎉 ¡Base de datos reseteada exitosamente!')
    console.log('📋 Credenciales de acceso:')
    console.log('   Email: admin@ynk.cl')
    console.log('   Contraseña: admin123')
    console.log('\n💡 Ahora puedes iniciar la aplicación con: npm run dev')

  } catch (error) {
    console.error('\n❌ Error reseteando base de datos:', error)

    if (error instanceof Error) {
      console.error('Detalle:', error.message)

      if (error.message.includes('migrate')) {
        console.log('\n💡 Intenta ejecutar manualmente:')
        console.log('   npx prisma migrate deploy')
        console.log('   npx prisma generate')
        console.log('   npm run create-user')
      }
    }

    process.exit(1)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  resetDatabase()
}

export { resetDatabase }
