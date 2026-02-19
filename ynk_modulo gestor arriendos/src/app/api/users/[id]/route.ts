import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireRole, UserRole } from '@/lib/utils/permissions'
import bcrypt from 'bcryptjs'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar sesión y permisos
    const session = await getServerSession(authOptions)
    requireRole(session, UserRole.ADMINISTRADOR)

    // Obtener usuario específico
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImage: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('❌ Error al obtener usuario:', error)
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar sesión y permisos
    const session = await getServerSession(authOptions)
    requireRole(session, UserRole.ADMINISTRADOR)

    const body = await request.json()
    const { email, password, name, role } = body

    // Validaciones básicas
    if (email !== undefined && (!email || email.trim() === '')) {
      return NextResponse.json(
        { error: 'El email no puede estar vacío' },
        { status: 400 }
      )
    }

    if (password !== undefined && password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    if (role !== undefined && !['VISUALIZADOR', 'GESTOR', 'ADMINISTRADOR'].includes(role)) {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser VISUALIZADOR, GESTOR o ADMINISTRADOR' },
        { status: 400 }
      )
    }

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el email no esté en uso por otro usuario
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email },
      })

      if (emailInUse) {
        return NextResponse.json(
          { error: 'Ya existe un usuario con este email' },
          { status: 409 }
        )
      }
    }

    // Preparar datos para actualizar
    const updateData: any = {}

    if (email !== undefined) updateData.email = email
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role

    // Hashear contraseña si se proporciona
    if (password !== undefined) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImage: true,
        createdAt: true,
      },
    })

    console.log(`✅ Usuario actualizado exitosamente: ${updatedUser.email}`)

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('❌ Error al actualizar usuario:', error)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar sesión y permisos
    const session = await getServerSession(authOptions)
    requireRole(session, UserRole.ADMINISTRADOR)

    // Verificar que el usuario existe
    const userToDelete = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    })

    if (!userToDelete) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // No permitir que un usuario se elimine a sí mismo
    if (session?.user?.id === params.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propia cuenta' },
        { status: 400 }
      )
    }

    // No permitir eliminar el último administrador
    if (userToDelete.role === 'ADMINISTRADOR') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMINISTRADOR' },
      })

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'No puedes eliminar el último administrador del sistema' },
          { status: 400 }
        )
      }
    }

    // Eliminar usuario
    await prisma.user.delete({
      where: { id: params.id },
    })

    console.log(`✅ Usuario eliminado exitosamente: ${userToDelete.email}`)

    return NextResponse.json({
      message: 'Usuario eliminado exitosamente',
      deletedUser: { id: params.id, email: userToDelete.email }
    })
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error)
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
