import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateUserSession } from '@/lib/utils/user'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = await validateUserSession(session)

    console.log('Profile fetched successfully:', { id: user.id, email: user.email })
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user profile:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage.includes('autorizado') || errorMessage.includes('encontrado') ? 401 : 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const currentUser = await validateUserSession(session)

    const body = await request.json()
    const { name, password, confirmPassword } = body

    // Validaciones
    if (name !== undefined && (!name || name.trim() === '')) {
      return NextResponse.json(
        { error: 'El nombre no puede estar vacío' },
        { status: 400 }
      )
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 6 caracteres' },
          { status: 400 }
        )
      }

      if (password !== confirmPassword) {
        return NextResponse.json(
          { error: 'Las contraseñas no coinciden' },
          { status: 400 }
        )
      }
    }

    // Preparar datos de actualización
    const updateData: any = {}
    if (name !== undefined) {
      updateData.name = name.trim()
    }
    if (password !== undefined) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el perfil del usuario' },
      { status: 500 }
    )
  }
}

