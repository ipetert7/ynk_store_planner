'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Store, StoreFormData, RentIncreaseType, GuaranteeType, Currency, RentIncreaseDateFormData } from '@/types/store'
import { calculateContractDuration } from '@/lib/utils'
import { formatNumber } from '@/lib/utils/format'
import { storeFormSchema } from '@/lib/validations/store'
import { storesService } from '@/lib/api/stores'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

interface StoreFormProps {
  store?: Store
  onSubmit: (data: StoreFormData) => Promise<void>
  skipRedirect?: boolean
}

interface FieldErrors {
  storeName?: string
  banner?: string
  erpId?: string
  contractStartDate?: string
  contractEndDate?: string
}

export default function StoreForm({ store, onSubmit, skipRedirect = false }: StoreFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [operators, setOperators] = useState<string[]>([])
  const [operatorsLoading, setOperatorsLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formData, setFormData] = useState<StoreFormData>({
    storeName: store?.storeName || '',
    banner: store?.banner || '',
    erpId: store?.erpId || '',
    surfaceAreaHall: store?.surfaceAreaHall || 0,
    surfaceAreaTotal: store?.surfaceAreaTotal || 0,
    shoppingCenterOperator: store?.shoppingCenterOperator || '',
    contractStartDate: store?.contractStartDate
      ? new Date(store.contractStartDate).toISOString().split('T')[0]
      : '',
    contractEndDate: store?.contractEndDate
      ? new Date(store.contractEndDate).toISOString().split('T')[0]
      : '',
    contractDuration: store?.contractDuration || 0,
    minimumMonthlyRent: store?.minimumMonthlyRent || 0,
    percentageRent: store?.percentageRent || 0,
    decemberFactor: store?.decemberFactor || 1,
    commonExpenses: store?.commonExpenses || 0,
    promotionFund: store?.promotionFund || 0,
    notificationPeriodDays: store?.notificationPeriodDays || 0,

    // Nuevos campos para renovación automática, aumentos y garantía
    autoRenewal: store?.autoRenewal || false,
    rentIncreaseType: store?.rentIncreaseType || null,
    annualRentIncreasePercentage: store?.annualRentIncreasePercentage || null,
    rentIncreaseDates: store?.rentIncreaseDates?.map(date => ({
      id: date.id,
      increaseDate: new Date(date.increaseDate).toISOString().split('T')[0],
      increasePercentage: date.increasePercentage,
    })) || [],
    guaranteeType: store?.guaranteeType || null,
    guaranteeAmount: store?.guaranteeAmount || null,
    guaranteeCurrency: store?.guaranteeCurrency || null,
  })

  useEffect(() => {
    if (formData.contractStartDate && formData.contractEndDate) {
      const startDate = new Date(formData.contractStartDate)
      const endDate = new Date(formData.contractEndDate)
      if (endDate > startDate) {
        const duration = calculateContractDuration(startDate, endDate)
        setFormData((prev) => ({ ...prev, contractDuration: duration }))
      }
    }
  }, [formData.contractStartDate, formData.contractEndDate])

  useEffect(() => {
    let mounted = true

    const loadOperators = async () => {
      setOperatorsLoading(true)
      try {
        const data = await storesService.getOperators()
        if (mounted) {
          setOperators(data)
        }
      } catch (err) {
        console.error('Error loading operators:', err)
      } finally {
        if (mounted) {
          setOperatorsLoading(false)
        }
      }
    }

    loadOperators()

    return () => {
      mounted = false
    }
  }, [])

  // Calcular superficie de bodega automáticamente
  const surfaceAreaWarehouse = formData.surfaceAreaTotal - formData.surfaceAreaHall

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? (e.target as HTMLInputElement).checked :
        name === 'surfaceAreaHall' ||
        name === 'surfaceAreaTotal' ||
        name === 'minimumMonthlyRent' ||
        name === 'percentageRent' ||
        name === 'decemberFactor' ||
        name === 'commonExpenses' ||
        name === 'promotionFund' ||
        name === 'annualRentIncreasePercentage' ||
        name === 'guaranteeAmount'
          ? parseFloat(value) || 0
          : name === 'contractDuration' || name === 'notificationPeriodDays'
          ? parseInt(value) || 0
          : name === 'rentIncreaseType' || name === 'guaranteeType' || name === 'guaranteeCurrency'
          ? value === '' ? null : value
          : value,
    }))

    // Clear field error when user starts typing
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  // Handlers para fechas de aumento específicas
  const handleRentIncreaseDateChange = (index: number, field: keyof RentIncreaseDateFormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      rentIncreaseDates: prev.rentIncreaseDates?.map((date, i) =>
        i === index ? { ...date, [field]: value } : date
      ) || [],
    }))
  }

  const addRentIncreaseDate = () => {
    setFormData((prev) => ({
      ...prev,
      rentIncreaseDates: [
        ...(prev.rentIncreaseDates || []),
        { increaseDate: '', increasePercentage: 0 },
      ],
    }))
  }

  const removeRentIncreaseDate = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      rentIncreaseDates: prev.rentIncreaseDates?.filter((_, i) => i !== index) || [],
    }))
  }

  const validateForm = (): boolean => {
    try {
      // Usar Zod para validar todos los campos
      storeFormSchema.parse(formData)
      setFieldErrors({})
      return true
    } catch (error: any) {
      // Convertir errores de Zod a formato de errores del formulario
      const fieldErrors: FieldErrors = {}

      if (error.errors) {
        error.errors.forEach((err: any) => {
          const fieldName = err.path[0] as keyof FieldErrors
          if (fieldName && typeof fieldName === 'string') {
            fieldErrors[fieldName] = err.message
          }
        })
      }

      setFieldErrors(fieldErrors)
      return false
    }
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
      if (!skipRedirect) {
        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar la tienda')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md" role="alert">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Sección 1: Información Básica */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">
            Información Básica
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Datos generales de la tienda y ubicación
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Input
              label="Nombre de Tienda"
              id="storeName"
              name="storeName"
              required
              value={formData.storeName}
              onChange={handleChange}
              error={fieldErrors.storeName}
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />

            <Input
              label="Banner (Marca)"
              id="banner"
              name="banner"
              required
              value={formData.banner}
              onChange={handleChange}
              error={fieldErrors.banner}
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
            />

            <Input
              label="ID del ERP"
              id="erpId"
              name="erpId"
              required
              value={formData.erpId}
              onChange={handleChange}
              error={fieldErrors.erpId}
              helperText="Identificador único de la tienda en el sistema ERP"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />

            <Input
              label="Superficie de Sala"
              id="surfaceAreaHall"
              name="surfaceAreaHall"
              type="number"
              step="0.01"
              value={formData.surfaceAreaHall || ''}
              onChange={handleChange}
              helperText="Superficie destinada a sala de ventas (m²)"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              }
            />

            <Input
              label="Superficie Total"
              id="surfaceAreaTotal"
              name="surfaceAreaTotal"
              type="number"
              step="0.01"
              value={formData.surfaceAreaTotal || ''}
              onChange={handleChange}
              helperText="Superficie total del local (m²)"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              }
            />

            <Input
              label="Superficie de Bodega"
              id="surfaceAreaWarehouse"
              name="surfaceAreaWarehouse"
              type="number"
              step="0.01"
              value={surfaceAreaWarehouse || ''}
              readOnly
              className="bg-gray-50 cursor-not-allowed"
              helperText="Superficie destinada a bodega (calculada automáticamente)"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              }
            />

            {/* Alerta cuando la superficie de sala es mayor que la total */}
            {formData.surfaceAreaHall > 0 && formData.surfaceAreaTotal > 0 && formData.surfaceAreaHall > formData.surfaceAreaTotal && (
              <div className="col-span-3 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      Error en las superficies
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      La superficie de sala ({formatNumber(formData.surfaceAreaHall)} m²) no puede ser mayor que la superficie total ({formatNumber(formData.surfaceAreaTotal)} m²).
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Input
              label="Operador Centro Comercial"
              id="shoppingCenterOperator"
              name="shoppingCenterOperator"
              value={formData.shoppingCenterOperator}
              onChange={handleChange}
              list="shopping-center-operators"
              autoComplete="off"
              helperText={
                operatorsLoading
                  ? 'Cargando operadores existentes...'
                  : 'Primero selecciona un operador existente; si no aparece, puedes escribir uno nuevo.'
              }
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <datalist id="shopping-center-operators">
              {operators.map((operator) => (
                <option key={operator} value={operator} />
              ))}
            </datalist>
          </div>
        </CardContent>
      </Card>

      {/* Sección 2: Información del Contrato */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">
            Información del Contrato
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Fechas, duración del contrato de arriendo y configuración de alertas
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Fecha Inicio Contrato"
              id="contractStartDate"
              name="contractStartDate"
              type="date"
              required
              value={formData.contractStartDate}
              onChange={handleChange}
              error={fieldErrors.contractStartDate}
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />

            <Input
              label="Fecha Término Contrato"
              id="contractEndDate"
              name="contractEndDate"
              type="date"
              required
              value={formData.contractEndDate}
              onChange={handleChange}
              error={fieldErrors.contractEndDate}
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />

            <div className="md:col-span-2">
              <Input
                label="Duración del Contrato"
                id="contractDuration"
                name="contractDuration"
                type="number"
                readOnly
                value={formData.contractDuration}
                helperText="Calculado automáticamente basado en las fechas de inicio y término"
                className="bg-gray-50 cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Período de Notificación"
                id="notificationPeriodDays"
                name="notificationPeriodDays"
                type="number"
                value={formData.notificationPeriodDays || ''}
                onChange={handleChange}
                helperText="Días antes del término del contrato para recibir notificación"
                leftIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sección 3: Información Financiera */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">
            Información Financiera
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Valores y porcentajes relacionados con el arriendo
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Valor Mínimo Mensual (VMM)"
              id="minimumMonthlyRent"
              name="minimumMonthlyRent"
              type="number"
              step="0.01"
              value={formData.minimumMonthlyRent || ''}
              onChange={handleChange}
              helperText="Valor mínimo mensual en UF$"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <Input
              label="Valor Porcentual"
              id="percentageRent"
              name="percentageRent"
              type="number"
              step="0.01"
              value={formData.percentageRent || ''}
              onChange={handleChange}
              helperText="Porcentaje sobre ventas (%)"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
            />

            <Input
              label="Factor Diciembre"
              id="decemberFactor"
              name="decemberFactor"
              type="number"
              step="0.01"
              value={formData.decemberFactor || ''}
              onChange={handleChange}
              helperText="Factor multiplicador para el mes de diciembre"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
            />

            <Input
              label="Gastos Comunes"
              id="commonExpenses"
              name="commonExpenses"
              type="number"
              step="0.01"
              value={formData.commonExpenses || ''}
              onChange={handleChange}
              helperText="Gastos comunes en UF$/m²"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />

            <Input
              label="Fondo de Promoción"
              id="promotionFund"
              name="promotionFund"
              type="number"
              step="0.01"
              value={formData.promotionFund || ''}
              onChange={handleChange}
              helperText="Fondo de promoción (% del VMM)"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Sección 4: Renovación Automática */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">
            Renovación Automática
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configura si el contrato se renueva automáticamente al término del plazo
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoRenewal"
              name="autoRenewal"
              checked={formData.autoRenewal}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoRenewal" className="ml-2 block text-sm text-gray-900">
              El contrato se renueva automáticamente al término del plazo
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Sección 5: Aumento Automático del Arriendo */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">
            Aumento Automático del Arriendo
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configura cómo se aplicarán los aumentos automáticos al valor del arriendo (VMM)
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Tipo de aumento */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Tipo de Aumento
              </label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="rentIncreaseNone"
                    name="rentIncreaseType"
                    value=""
                    checked={!formData.rentIncreaseType}
                    onChange={(e) => setFormData(prev => ({ ...prev, rentIncreaseType: null, annualRentIncreasePercentage: null, rentIncreaseDates: [] }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="rentIncreaseNone" className="ml-2 block text-sm text-gray-900">
                    Sin aumento automático
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="rentIncreaseAnnual"
                    name="rentIncreaseType"
                    value={RentIncreaseType.ANNUAL}
                    checked={formData.rentIncreaseType === RentIncreaseType.ANNUAL}
                    onChange={(e) => setFormData(prev => ({ ...prev, rentIncreaseType: RentIncreaseType.ANNUAL, rentIncreaseDates: [] }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="rentIncreaseAnnual" className="ml-2 block text-sm text-gray-900">
                    Aumento anual
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="rentIncreaseSpecific"
                    name="rentIncreaseType"
                    value={RentIncreaseType.SPECIFIC_DATES}
                    checked={formData.rentIncreaseType === RentIncreaseType.SPECIFIC_DATES}
                    onChange={(e) => setFormData(prev => ({ ...prev, rentIncreaseType: RentIncreaseType.SPECIFIC_DATES, annualRentIncreasePercentage: null }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="rentIncreaseSpecific" className="ml-2 block text-sm text-gray-900">
                    Aumentos en fechas específicas
                  </label>
                </div>
              </div>
            </div>

            {/* Configuración de aumento anual */}
            {formData.rentIncreaseType === RentIncreaseType.ANNUAL && (
              <div>
                <Input
                  label="Porcentaje de Aumento Anual"
                  id="annualRentIncreasePercentage"
                  name="annualRentIncreasePercentage"
                  type="number"
                  step="0.01"
                  value={formData.annualRentIncreasePercentage || ''}
                  onChange={handleChange}
                  helperText="Porcentaje de aumento aplicado cada año desde la fecha de inicio del contrato"
                  leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  }
                />
              </div>
            )}

            {/* Configuración de aumentos en fechas específicas */}
            {formData.rentIncreaseType === RentIncreaseType.SPECIFIC_DATES && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-medium text-gray-700">
                    Fechas de Aumento
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addRentIncreaseDate}
                    className="flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Agregar Fecha
                  </Button>
                </div>

                <div className="space-y-4">
                  {formData.rentIncreaseDates?.map((date, index) => (
                    <div key={index} className="flex items-end gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <Input
                          label="Fecha de Aumento"
                          type="date"
                          value={date.increaseDate}
                          onChange={(e) => handleRentIncreaseDateChange(index, 'increaseDate', e.target.value)}
                          leftIcon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          label="Porcentaje (%)"
                          type="number"
                          step="0.01"
                          value={date.increasePercentage || ''}
                          onChange={(e) => handleRentIncreaseDateChange(index, 'increasePercentage', parseFloat(e.target.value) || 0)}
                          leftIcon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeRentIncreaseDate(index)}
                        className="mb-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  ))}
                </div>

                {(!formData.rentIncreaseDates || formData.rentIncreaseDates.length === 0) && (
                  <p className="text-sm text-gray-500 italic">
                    No hay fechas de aumento configuradas. Haz clic en "Agregar Fecha" para comenzar.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sección 6: Garantía */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-gray-900">
            Garantía
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configura el tipo de garantía que respalda el contrato de arriendo
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Tipo de garantía */}
            <div>
              <label htmlFor="guaranteeType" className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Garantía
              </label>
              <select
                id="guaranteeType"
                name="guaranteeType"
                value={formData.guaranteeType || ''}
                onChange={handleChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Sin garantía</option>
                <option value={GuaranteeType.CASH}>Efectivo</option>
                <option value={GuaranteeType.BANK_GUARANTEE}>Boleta de garantía bancaria</option>
              </select>
            </div>

            {/* Monto y moneda de la garantía */}
            {formData.guaranteeType && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Monto de la Garantía"
                  id="guaranteeAmount"
                  name="guaranteeAmount"
                  type="number"
                  step="0.01"
                  value={formData.guaranteeAmount || ''}
                  onChange={handleChange}
                  leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Moneda
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="guaranteeCurrencyCLP"
                        name="guaranteeCurrency"
                        value={Currency.CLP}
                        checked={formData.guaranteeCurrency === Currency.CLP}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="guaranteeCurrencyCLP" className="ml-2 block text-sm text-gray-900">
                        Pesos Chilenos ($)
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="guaranteeCurrencyUF"
                        name="guaranteeCurrency"
                        value={Currency.UF}
                        checked={formData.guaranteeCurrency === Currency.UF}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="guaranteeCurrencyUF" className="ml-2 block text-sm text-gray-900">
                        Unidad de Fomento (UF$)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={loading}
          disabled={loading}
          className="flex-1"
        >
          {store ? 'Actualizar Tienda' : 'Crear Tienda'}
        </Button>
        {!skipRedirect && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
