import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateUserSession } from '@/lib/utils/user'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = await validateUserSession(session)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG o WebP' },
        { status: 400 }
      )
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. El tamaño máximo es 5MB' },
        { status: 400 }
      )
    }

    // Obtener extensión del archivo
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(`.${fileExtension}`)) {
      return NextResponse.json(
        { error: 'Extensión de archivo no permitida' },
        { status: 400 }
      )
    }

    // Obtener usuario actual para verificar si tiene imagen anterior
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profileImage: true },
    })

    // Eliminar imagen anterior si existe
    if (currentUser?.profileImage) {
      const oldImagePath = join(process.cwd(), 'public', currentUser.profileImage!)
      if (existsSync(oldImagePath)) {
        try {
          await unlink(oldImagePath)
        } catch (error) {
          console.error('Error eliminando imagen anterior:', error)
        }
      }
    }

    // Crear nombre de archivo único usando userId
    const fileName = `${user.id}.${fileExtension}`
    const profilesDir = join(process.cwd(), 'public', 'images', 'profiles')
    
    // Asegurar que el directorio existe
    const { mkdir } = await import('fs/promises')
    try {
      await mkdir(profilesDir, { recursive: true })
    } catch (error) {
      // El directorio ya existe, continuar
    }

    // Guardar archivo
    const filePath = join(profilesDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Ruta relativa para almacenar en la base de datos
    const relativePath = `/images/profiles/${fileName}`

    // Actualizar usuario con nueva ruta de imagen
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { profileImage: relativePath },
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
      },
    })

    return NextResponse.json({
      profileImage: updatedUser.profileImage,
      message: 'Foto de perfil actualizada correctamente',
    })
  } catch (error) {
    console.error('Error uploading profile image:', error)
    return NextResponse.json(
      { error: 'Error al subir la foto de perfil' },
      { status: 500 }
    )
  }
}

