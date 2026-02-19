import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log('❌ Credenciales faltantes')
            return null
          }

          console.log('🔍 Buscando usuario:', credentials.email)
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          })

          if (!user) {
            console.log('❌ Usuario no encontrado:', credentials.email)
            return null
          }

          console.log('✅ Usuario encontrado:', user.email)
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            console.log('❌ Contraseña inválida para:', credentials.email)
            return null
          }

          console.log('✅ Autenticación exitosa para:', user.email)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            profileImage: user.profileImage || null,
            role: user.role,
          }
        } catch (error) {
          console.error('❌ Error en authorize:', error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Cuando se hace login, establecer los datos del usuario
      if (user) {
        token.id = user.id
        token.profileImage = user.profileImage || null
        token.role = user.role
      }
      
      // Cuando se actualiza la sesión (desde updateSession), obtener los datos más recientes de la BD
      if (trigger === 'update' && token.id) {
        try {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              name: true,
              email: true,
              profileImage: true,
              role: true,
            },
          })

          if (updatedUser) {
            token.name = updatedUser.name
            token.email = updatedUser.email
            token.profileImage = updatedUser.profileImage || null
            token.role = updatedUser.role
          } else {
            // Usuario no encontrado en BD, limpiar token para forzar re-login
            console.warn('Usuario no encontrado en BD durante actualización de token:', token.id)
            token.id = null
            token.name = null
            token.email = null
            token.profileImage = null
            token.role = null
          }
        } catch (error) {
          console.error('Error actualizando token desde BD:', error)
          // En caso de error de BD, mantener los datos actuales del token
          // para no romper la sesión por problemas temporales de conectividad
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.profileImage = token.profileImage || null
        session.user.role = token.role as string
        // Asegurar que el nombre y email también estén actualizados
        if (token.name) session.user.name = token.name as string
        if (token.email) session.user.email = token.email as string
      }
      return session
    },
  },
}

