#!/usr/bin/env tsx

import { prisma } from '../src/lib/prisma'

async function checkUsers() {
  try {
    console.log('🔍 Verificando usuarios en la base de datos...\n')
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    console.log(`📊 Total de usuarios: ${users.length}\n`)

    if (users.length === 0) {
      console.log('❌ No hay usuarios en la base de datos')
      console.log('💡 Ejecuta: npm run create-user')
    } else {
      console.log('👥 Usuarios encontrados:')
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name} (${user.email})`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Rol: ${user.role}`)
        console.log(`   Creado: ${user.createdAt.toLocaleString('es-ES')}`)
      })
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkUsers()

