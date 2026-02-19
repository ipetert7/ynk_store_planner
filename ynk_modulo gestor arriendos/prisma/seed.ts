import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Crear usuario inicial
  const email = 'jpz@ynk.cl'
  const oldEmail = 'admin@ynk.com'
  const password = 'jpz1234'
  const name = 'Jacques Polette'

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    console.log('✅ Usuario ya existe:', email)
    // Asegurar que la contraseña sea correcta
    const isPasswordValid = await bcrypt.compare(password, existingUser.password)
    if (!isPasswordValid) {
      console.log('🔄 Actualizando contraseña...')
      const hashedPassword = await bcrypt.hash(password, 10)
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword },
      })
      console.log('✅ Contraseña actualizada')
    }
  } else {
    // Verificar si existe el usuario con el email antiguo
    const oldUser = await prisma.user.findUnique({
      where: { email: oldEmail },
    })

    if (oldUser) {
      console.log('🔄 Migrando usuario de', oldEmail, 'a', email)
      const hashedPassword = await bcrypt.hash(password, 10)
      await prisma.user.update({
        where: { id: oldUser.id },
        data: {
          email,
          password: hashedPassword,
          name,
        },
      })
      console.log('✅ Usuario migrado:', email)
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
      })
      console.log('✅ Usuario creado:', user.email)
    }
    console.log('📧 Email:', email)
    console.log('🔑 Contraseña:', password)
  }

  // Crear tienda de prueba con nuevos campos
  const existingStore = await prisma.store.findFirst({
    where: { storeName: 'Tienda Test Backup' }
  })

  if (!existingStore) {
    const testStore = await prisma.store.create({
      data: {
        storeName: 'Tienda Test Backup',
        banner: 'Test Banner',
        surfaceAreaHall: 80,
        surfaceAreaTotal: 100,
        shoppingCenterOperator: 'Test Operator',
        contractStartDate: new Date('2024-01-01'),
        contractEndDate: new Date('2025-01-01'),
        contractDuration: 365,
        minimumMonthlyRent: 500,
        percentageRent: 5,
        decemberFactor: 2,
        commonExpenses: 25.5,
        promotionFund: 10.0,
        notificationPeriodDays: 30,
      }
    })
    console.log('✅ Tienda de prueba creada:', testStore.storeName)
    console.log('   📊 Gastos comunes:', testStore.commonExpenses, 'UF$/m²')
    console.log('   📈 Fondo de promoción:', testStore.promotionFund, '%')
  } else {
    console.log('✅ Tienda de prueba ya existe')
  }

  // Migrar usuarios existentes a rol ADMINISTRADOR
  console.log('🔄 Verificando roles de usuarios existentes...')
  const existingUsers = await prisma.user.findMany({
    where: {
      role: 'VISUALIZADOR', // El valor por defecto
    }
  })

  if (existingUsers.length > 0) {
    console.log(`🔄 Migrando ${existingUsers.length} usuarios existentes a rol ADMINISTRADOR...`)

    await prisma.user.updateMany({
      where: {
        role: 'VISUALIZADOR',
      },
      data: {
        role: 'ADMINISTRADOR'
      }
    })

    console.log('✅ Usuarios existentes migrados a ADMINISTRADOR')
  } else {
    console.log('ℹ️ No hay usuarios con rol VISUALIZADOR para migrar')
  }

  // Asegurar que el usuario principal tenga rol ADMINISTRADOR
  const mainUser = await prisma.user.findUnique({
    where: { email: email }
  })

  if (mainUser && mainUser.role !== 'ADMINISTRADOR') {
    await prisma.user.update({
      where: { id: mainUser.id },
      data: { role: 'ADMINISTRADOR' }
    })
    console.log('✅ Usuario principal actualizado a rol ADMINISTRADOR')
  }

  console.log('✨ Seed completado!')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

