'use client'

import { useState, useEffect } from 'react'
import { User } from '@/hooks/useUsers'
import { UserRole, getAllRoles, getRoleDisplayName } from '@/lib/utils/permissions'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface UserFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (userData: UserFormData) => Promise<void>
  user?: User | null
  loading: boolean
  error: string | null
  mode: 'create' | 'edit'
}

export interface UserFormData {
  email: string
  password?: string
  name: string
  role: UserRole
}

export default function UserForm({
  isOpen,
  onClose,
  onSubmit,
  user,
  loading,
  error,
  mode,
}: UserFormProps) {
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    name: '',
    role: UserRole.VISUALIZADOR,
  })

  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Reset form when modal opens/closes or user changes
  useEffect(() => {
    if (isOpen) {
      if (user && mode === 'edit') {
        setFormData({
          email: user.email,
          password: '', // No pre-llenar contraseña en edición
          name: user.name || '',
          role: user.role as UserRole,
        })
        setConfirmPassword('')
      } else {
        setFormData({
          email: '',
          password: '',
          name: '',
          role: UserRole.VISUALIZADOR,
        })
        setConfirmPassword('')
      }
      setValidationErrors({})
    }
  }, [isOpen, user, mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones básicas
    const errors: Record<string, string> = {}

    if (!formData.email.trim()) {
      errors.email = 'El email es obligatorio'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'El email debe tener un formato válido'
    }

    if (mode === 'create' || formData.password) {
      if (!formData.password || formData.password.length < 6) {
        errors.password = 'La contraseña debe tener al menos 6 caracteres'
      } else if (formData.password !== confirmPassword) {
        errors.confirmPassword = 'Las contraseñas no coinciden'
      }
    }

    if (!formData.name.trim()) {
      errors.name = 'El nombre es obligatorio'
    }

    if (!formData.role) {
      errors.role = 'El rol es obligatorio'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    // Preparar datos para envío
    const submitData = { ...formData }
    if (mode === 'edit' && !submitData.password) {
      delete submitData.password // No enviar contraseña vacía en edición
    }

    try {
      await onSubmit(submitData)
      onClose()
    } catch (err) {
      // El error se maneja en el componente padre
    }
  }

  const handleInputChange = (field: keyof UserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Limpiar error de validación cuando el usuario empiece a escribir
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Crear Usuario' : 'Editar Usuario'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="usuario@ejemplo.com"
            error={validationErrors.email}
            disabled={loading}
          />
        </div>

        {/* Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Nombre *
          </label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Nombre completo"
            error={validationErrors.name}
            disabled={loading}
          />
        </div>

        {/* Contraseña */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Contraseña {mode === 'create' ? '*' : '(dejar vacío para mantener actual)'}
          </label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder={mode === 'create' ? 'Mínimo 6 caracteres' : 'Nueva contraseña'}
            error={validationErrors.password}
            disabled={loading}
          />
        </div>

        {/* Confirmar Contraseña (solo en creación o si se cambió la contraseña) */}
        {(mode === 'create' || formData.password) && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Contraseña *
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetir contraseña"
              error={validationErrors.confirmPassword}
              disabled={loading}
            />
          </div>
        )}

        {/* Rol */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
            Rol *
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value as UserRole)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
              validationErrors.role ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={loading}
          >
            {getAllRoles().map((role) => (
              <option key={role} value={role}>
                {getRoleDisplayName(role)}
              </option>
            ))}
          </select>
          {validationErrors.role && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.role}</p>
          )}
        </div>

        {/* Descripción de roles */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Descripción de roles:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li><strong>Visualizador:</strong> Solo puede ver datos</li>
            <li><strong>Gestor:</strong> Puede crear, modificar y terminar tiendas</li>
            <li><strong>Administrador:</strong> Tiene todos los permisos, incluyendo gestión de usuarios</li>
          </ul>
        </div>

        {/* Error general */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {mode === 'create' ? 'Creando...' : 'Guardando...'}
              </>
            ) : (
              mode === 'create' ? 'Crear Usuario' : 'Guardar Cambios'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
