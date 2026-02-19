'use client'

import { useState, useRef, ChangeEvent } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'

interface UserProfileFormProps {
  initialData: {
    name: string
    email: string
    profileImage?: string | null
  }
  onSubmit: (data: {
    name: string
    password?: string
    confirmPassword?: string
    profileImage?: File | null
  }) => Promise<void>
}

interface FieldErrors {
  name?: string
  password?: string
  confirmPassword?: string
  profileImage?: string
}

export default function UserProfileForm({ initialData, onSubmit }: UserProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formData, setFormData] = useState({
    name: initialData.name,
    password: '',
    confirmPassword: '',
  })
  const [profileImage, setProfileImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData.profileImage || null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    
    // Clear field error when user starts typing
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
    
    // Clear general error
    if (error) {
      setError('')
    }
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        profileImage: 'Solo se permiten imágenes JPEG, PNG o WebP',
      }))
      return
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        profileImage: 'El archivo es demasiado grande. El tamaño máximo es 5MB',
      }))
      return
    }

    setProfileImage(file)
    setFieldErrors((prev) => ({ ...prev, profileImage: undefined }))

    // Crear preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setProfileImage(null)
    setImagePreview(initialData.profileImage || null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validateForm = (): boolean => {
    const errors: FieldErrors = {}
    
    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido'
    }
    
    if (formData.password) {
      if (formData.password.length < 6) {
        errors.password = 'La contraseña debe tener al menos 6 caracteres'
      }
      
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Las contraseñas no coinciden'
      }
    }
    
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        name: formData.name.trim(),
        password: formData.password || undefined,
        confirmPassword: formData.confirmPassword || undefined,
        profileImage: profileImage,
      })
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el perfil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Foto de perfil */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Foto de perfil
        </label>
        <div className="flex items-center gap-6">
          <Avatar
            src={imagePreview || undefined}
            name={formData.name}
            size="lg"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
                id="profile-image-input"
              />
              <label
                htmlFor="profile-image-input"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {profileImage ? 'Cambiar foto' : 'Seleccionar foto'}
              </label>
              {(profileImage || imagePreview) && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>
            {fieldErrors.profileImage && (
              <p className="text-sm text-red-600">{fieldErrors.profileImage}</p>
            )}
            <p className="text-xs text-gray-500">
              Formatos permitidos: JPEG, PNG, WebP. Tamaño máximo: 5MB
            </p>
          </div>
        </div>
      </div>

      {/* Nombre */}
      <Input
        label="Nombre"
        name="name"
        value={formData.name}
        onChange={handleChange}
        error={fieldErrors.name}
        required
      />

      {/* Email (solo lectura) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={initialData.email}
          disabled
          className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 cursor-not-allowed"
        />
        <p className="mt-1.5 text-xs text-gray-500">
          El email no se puede modificar
        </p>
      </div>

      {/* Contraseña nueva */}
      <Input
        label="Nueva contraseña"
        name="password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        error={fieldErrors.password}
        helperText="Dejar en blanco si no deseas cambiar la contraseña"
      />

      {/* Confirmar contraseña */}
      {formData.password && (
        <Input
          label="Confirmar nueva contraseña"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={fieldErrors.confirmPassword}
        />
      )}

      {/* Botones */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setFormData({
              name: initialData.name,
              password: '',
              confirmPassword: '',
            })
            setProfileImage(null)
            setImagePreview(initialData.profileImage || null)
            setFieldErrors({})
            setError('')
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          }}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}

