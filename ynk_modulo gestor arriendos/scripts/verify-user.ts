import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verificando usuario...')

  const email = 'admin@ynk.cl'
  const password = 'admin123'

  // Buscar usuario existente
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    console.log('✅ Usuario encontrado:', existingUser.email)
    console.log('📧 Email:', existingUser.email)
    console.log('👤 Nombre:', existingUser.name)
    console.log('🔑 Hash de contraseña:', existingUser.password.substring(0, 20) + '...')
    
    // Verificar contraseña
    const isValid = await bcrypt.compare(password, existingUser.password)
    console.log('🔐 Contraseña válida:', isValid ? '✅ SÍ' : '❌ NO')
    
    if (!isValid) {
      console.log('\n⚠️  La contraseña no coincide. Recreando usuario...')
      const hashedPassword = await bcrypt.hash(password, 10)
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword },
      })
      console.log('✅ Contraseña actualizada')
    }
  } else {
    console.log('❌ Usuario no encontrado. Creando nuevo usuario...')
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Administrador',
      },
    })
    console.log('✅ Usuario creado:', user.email)
    console.log('📧 Email:', email)
    console.log('🔑 Contraseña:', password)
  }

  console.log('\n✨ Verificación completada!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

