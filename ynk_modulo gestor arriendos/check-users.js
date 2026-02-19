const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    console.log('🔍 Verificando usuarios en la base de datos...')

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })

    console.log(`📊 Encontrados ${users.length} usuarios:`)
    users.forEach(user => {
      console.log(`  - ID: ${user.id}`)
      console.log(`    Email: ${user.email}`)
      console.log(`    Nombre: ${user.name}`)
      console.log(`    Creado: ${user.createdAt}`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Error al verificar usuarios:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
