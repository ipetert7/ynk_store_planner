import { z } from 'zod'
import { UserRole } from '@/lib/utils/permissions'

// Schema para crear usuario
export const createUserSchema = z.object({
  email: z
    .string()
    .email('El email debe tener un formato válido')
    .min(1, 'El email es obligatorio'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña no puede tener más de 100 caracteres'),
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede tener más de 100 caracteres')
    .optional(),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'El rol debe ser VISUALIZADOR, GESTOR o ADMINISTRADOR' }),
  }),
})

// Schema para actualizar usuario
export const updateUserSchema = z.object({
  email: z
    .string()
    .email('El email debe tener un formato válido')
    .min(1, 'El email es obligatorio')
    .optional(),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña no puede tener más de 100 caracteres')
    .optional(),
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede tener más de 100 caracteres')
    .optional(),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'El rol debe ser VISUALIZADOR, GESTOR o ADMINISTRADOR' }),
  }).optional(),
})

// Tipos inferidos
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

// Función para validar email único
export async function validateUniqueEmail(email: string, excludeUserId?: string): Promise<boolean> {
  // Esta función se implementará en las rutas API donde tengamos acceso a Prisma
  // Por ahora retornamos true (se validará en las rutas)
  return true
}

// Función helper para formatear errores de validación
export function formatValidationErrors(error: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {}

  error.errors.forEach((err) => {
    const path = err.path.join('.')
    formattedErrors[path] = err.message
  })

  return formattedErrors
}