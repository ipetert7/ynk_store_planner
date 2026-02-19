'use client'

import { useState } from 'react'
import { TemporaryModificationFormData } from '@/types/store'
import { temporaryModificationSchema } from '@/lib/validations/store'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

interface TemporaryModificationFormProps {
  storeId: string
  onSubmit: (data: TemporaryModificationFormData) => Promise<void>
  onCancel?: () => void
  initialValues?: Partial<TemporaryModificationFormData>
  variant?: 'card' | 'plain'
  showHeader?: boolean
}

interface FieldErrors {
  startDate?: string
  endDate?: string
  minimumMonthlyRent?: string
  percentageRent?: string
  decemberFactor?: string
}

export default function TemporaryModificationForm({
  storeId,
  onSubmit,
  onCancel,
  initialValues,
  variant = 'card',
  showHeader = true,
}: TemporaryModificationFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formData, setFormData] = useState<TemporaryModificationFormData>({
    startDate: initialValues?.startDate || '',
    endDate: initialValues?.endDate || '',
    minimumMonthlyRent: initialValues?.minimumMonthlyRent ?? 0,
    percentageRent: initialValues?.percentageRent ?? 0,
    decemberFactor: initialValues?.decemberFactor ?? 1,
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'minimumMonthlyRent' ||
        name === 'percentageRent' ||
        name === 'decemberFactor'
          ? parseFloat(value) || 0
          : value,
    }))
    
    // Clear field error when user starts typing
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    setError('')
    setFieldErrors({})
    
    try {
      temporaryModificationSchema.parse(formData)
      return true
    } catch (err: any) {
      if (err.errors) {
        const errors: FieldErrors = {}
        err.errors.forEach((error: any) => {
          const field = error.path[0]
          if (field) {
            errors[field as keyof FieldErrors] = error.message
          }
        })
        setFieldErrors(errors)
      }
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      setError('Por favor corrige los errores en el formulario')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSubmit(formData)
      // Reset form on success
      setFormData({
        startDate: '',
        endDate: '',
        minimumMonthlyRent: 0,
        percentageRent: 0,
        decemberFactor: 1,
      })
    } catch (err: any) {
      setError(err.message || 'Error al crear la modificación')
    } finally {
      setLoading(false)
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md" role="alert">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Fecha de Inicio"
          name="startDate"
          type="date"
          value={formData.startDate}
          onChange={handleChange}
          error={fieldErrors.startDate}
          required
        />

        <Input
          label="Fecha de Término"
          name="endDate"
          type="date"
          value={formData.endDate}
          onChange={handleChange}
          error={fieldErrors.endDate}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input
          label="VMM (UF$)"
          name="minimumMonthlyRent"
          type="number"
          step="0.01"
          min="0"
          value={formData.minimumMonthlyRent}
          onChange={handleChange}
          error={fieldErrors.minimumMonthlyRent}
          required
        />

        <Input
          label="Porcentaje de Arriendo (%)"
          name="percentageRent"
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={formData.percentageRent}
          onChange={handleChange}
          error={fieldErrors.percentageRent}
          required
        />

        <Input
          label="Factor de Diciembre"
          name="decemberFactor"
          type="number"
          step="0.01"
          min="0"
          max="10"
          value={formData.decemberFactor}
          onChange={handleChange}
          error={fieldErrors.decemberFactor}
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
        >
          Crear Modificación
        </Button>
      </div>
    </form>
  )

  if (variant === 'plain') {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Nueva Modificación Temporal
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Ingresa las condiciones temporales que se aplicarán durante el período especificado
            </p>
          </div>
        )}
        {formContent}
      </div>
    )
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">
            Nueva Modificación Temporal
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Ingresa las condiciones temporales que se aplicarán durante el período especificado
          </p>
        </CardHeader>
      )}
      <CardContent>{formContent}</CardContent>
    </Card>
  )
}
