'use client'

import { useState } from 'react'
import { Store } from '@/types/store'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export interface PermanentModificationFormData {
  contractStartDate: string
  contractEndDate: string
  minimumMonthlyRent: number
  percentageRent: number
  decemberFactor: number
  notificationPeriodDays: number
}

interface FieldErrors {
  contractStartDate?: string
  contractEndDate?: string
  minimumMonthlyRent?: string
  percentageRent?: string
  decemberFactor?: string
  notificationPeriodDays?: string
}

interface PermanentModificationFormProps {
  store: Store
  onSubmit: (data: PermanentModificationFormData) => Promise<void>
  onCancel?: () => void
}

export default function PermanentModificationForm({
  store,
  onSubmit,
  onCancel,
}: PermanentModificationFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formData, setFormData] = useState<PermanentModificationFormData>({
    contractStartDate: new Date(store.contractStartDate).toISOString().split('T')[0],
    contractEndDate: new Date(store.contractEndDate).toISOString().split('T')[0],
    minimumMonthlyRent: store.minimumMonthlyRent ?? 0,
    percentageRent: store.percentageRent ?? 0,
    decemberFactor: store.decemberFactor ?? 1,
    notificationPeriodDays: store.notificationPeriodDays ?? 0,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'minimumMonthlyRent' ||
        name === 'percentageRent' ||
        name === 'decemberFactor' ||
        name === 'notificationPeriodDays'
          ? Number(value) || 0
          : value,
    }))

    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const errors: FieldErrors = {}

    if (!formData.contractStartDate) {
      errors.contractStartDate = 'La fecha de inicio es requerida'
    }

    if (!formData.contractEndDate) {
      errors.contractEndDate = 'La fecha de término es requerida'
    }

    if (formData.contractStartDate && formData.contractEndDate) {
      const startDate = new Date(formData.contractStartDate)
      const endDate = new Date(formData.contractEndDate)
      if (endDate <= startDate) {
        errors.contractEndDate = 'La fecha de término debe ser posterior a la fecha de inicio'
      }
    }

    if (formData.minimumMonthlyRent < 0) {
      errors.minimumMonthlyRent = 'El VMM debe ser mayor o igual a 0'
    }

    if (formData.percentageRent < 0 || formData.percentageRent > 100) {
      errors.percentageRent = 'El porcentaje debe estar entre 0 y 100'
    }

    if (formData.decemberFactor < 0 || formData.decemberFactor > 10) {
      errors.decemberFactor = 'El factor de diciembre debe estar entre 0 y 10'
    }

    if (formData.notificationPeriodDays < 0 || formData.notificationPeriodDays > 365) {
      errors.notificationPeriodDays = 'Los días de notificación deben estar entre 0 y 365'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      setError('Por favor corrige los errores en el formulario')
      return
    }

    setLoading(true)

    try {
      await onSubmit(formData)
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el contrato')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md" role="alert">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Fecha de Inicio"
          name="contractStartDate"
          type="date"
          value={formData.contractStartDate}
          onChange={handleChange}
          error={fieldErrors.contractStartDate}
          required
        />

        <Input
          label="Fecha de Término"
          name="contractEndDate"
          type="date"
          value={formData.contractEndDate}
          onChange={handleChange}
          error={fieldErrors.contractEndDate}
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

      <Input
        label="Período de Notificación (días)"
        name="notificationPeriodDays"
        type="number"
        min="0"
        max="365"
        value={formData.notificationPeriodDays}
        onChange={handleChange}
        error={fieldErrors.notificationPeriodDays}
        required
      />

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
        <Button type="submit" variant="primary" isLoading={loading}>
          Guardar Cambios
        </Button>
      </div>
    </form>
  )
}
