import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireRole, UserRole } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  try {
    // Verificar sesión y permisos
    const session = await getServerSession(authOptions)
    requireRole(session, UserRole.ADMINISTRADOR)

    // Obtener todos los usuarios
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImage: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`✅ Usuarios listados exitosamente: ${users.length} usuarios encontrados`)

    return NextResponse.json(users)
  } catch (error) {
    console.error('❌ Error al listar usuarios:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    const statusCode = errorMessage.includes('No autorizado') ? 403 : 500

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: statusCode }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar sesión y permisos
    const session = await getServerSession(authOptions)
    requireRole(session, UserRole.ADMINISTRADOR)

    const body = await request.json()
    const { email, password, name, role } = body

    // Validaciones básicas
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Email, contraseña y rol son obligatorios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Validar rol
    if (!['VISUALIZADOR', 'GESTOR', 'ADMINISTRADOR'].includes(role)) {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser VISUALIZADOR, GESTOR o ADMINISTRADOR' },
        { status: 400 }
      )
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con este email' },
        { status: 409 }
      )
    }

    // Crear usuario
    const hashedPassword = await require('bcryptjs').hash(password, 10)

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImage: true,
        createdAt: true,
      },
    })

    console.log(`✅ Usuario creado exitosamente: ${newUser.email}`)

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('❌ Error al crear usuario:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    const statusCode = errorMessage.includes('No autorizado') ? 403 : 500

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: statusCode }
    )
  }
}
