import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/lib/utils/permissions'

/**
 * Valida que la sesión contiene un usuario válido y que existe en la base de datos
 * @param session - La sesión de NextAuth
 * @returns El usuario de la base de datos
 * @throws Error si la sesión es inválida o el usuario no existe
 */
export async function validateUserSession(session: Session | null): Promise<{
  id: string
  email: string
  name: string
  profileImage: string | null
  role: string
}> {
  if (!session) {
    throw new Error('No autorizado - sesión requerida')
  }

  if (!session.user?.id && !session.user?.email) {
    throw new Error('Sesión inválida - usuario no encontrado')
  }

  // Intentar buscar por ID primero
  let user = null
  if (session.user?.id) {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
        role: true,
      },
    })
  }

  // Si no se encuentra por ID, intentar por email (útil después de reset de BD)
  if (!user && session.user?.email) {
    user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
        role: true,
      },
    })
  }

  if (!user) {
    const identifier = session.user?.id || session.user?.email || 'desconocido'
    throw new Error(`Usuario no encontrado en la base de datos (ID/Email: ${identifier}). Por favor, cierra sesión y vuelve a iniciar sesión.`)
  }

  return user
}

/**
 * Obtiene el rol de un usuario desde la sesión
 * @param session - La sesión de NextAuth
 * @returns El rol del usuario o null si no hay sesión
 */
export function getUserRole(session: Session | null): UserRole | null {
  if (!session?.user?.role) {
    return null
  }

  return session.user.role as UserRole
}
