import { z } from 'zod'
import { RentIncreaseType, GuaranteeType, Currency } from '@/types/store'

/**
 * Schema de validación para fechas de aumento específicas
 */
export const rentIncreaseDateSchema = z.object({
  id: z.string().optional(),
  increaseDate: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Fecha de aumento inválida'
  ),
  increasePercentage: z.number().min(0, 'El porcentaje debe ser mayor o igual a 0').max(1000, 'El porcentaje debe estar entre 0 y 1000'),
})

/**
 * Schema de validación para crear/actualizar una tienda
 */
/**
 * Schema para crear una nueva tienda (erpId requerido)
 */
export const createStoreSchema = z.object({
  storeName: z.string().min(1, 'El nombre de la tienda es requerido').max(200),
  banner: z.string().min(1, 'El banner es requerido').max(200),
  erpId: z.string().min(1, 'El ID del ERP es requerido').max(50, 'El ID del ERP debe tener máximo 50 caracteres'),
  surfaceAreaHall: z.number().min(0, 'La superficie de sala debe ser mayor o igual a 0'),
  surfaceAreaTotal: z.number().min(0, 'La superficie total debe ser mayor o igual a 0'),
  shoppingCenterOperator: z.string().max(200).optional(),
  contractStartDate: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Fecha de inicio inválida'
  ),
  contractEndDate: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Fecha de término inválida'
  ),
  contractDuration: z.number().min(0),
  minimumMonthlyRent: z.number().min(0, 'El VMM debe ser mayor o igual a 0'),
  percentageRent: z.number().min(0).max(100, 'El porcentaje debe estar entre 0 y 100'),
  decemberFactor: z.number().min(0).max(10, 'El factor de diciembre debe estar entre 0 y 10'),
  commonExpenses: z.number().min(0, 'Los gastos comunes deben ser mayor o igual a 0'),
  promotionFund: z.number().min(0).max(100, 'El fondo de promoción debe estar entre 0 y 100'),
  notificationPeriodDays: z.number().min(0).max(365, 'Los días de notificación deben estar entre 0 y 365'),

  // Nuevos campos para renovación automática, aumentos y garantía
  autoRenewal: z.boolean().default(false),
  rentIncreaseType: z.enum(['ANNUAL', 'SPECIFIC_DATES']).nullable().optional(),
  annualRentIncreasePercentage: z.number().min(0).max(1000, 'El porcentaje debe estar entre 0 y 1000').nullable().optional(),
  rentIncreaseDates: z.array(rentIncreaseDateSchema).optional(),
  guaranteeType: z.enum(['CASH', 'BANK_GUARANTEE']).nullable().optional(),
  guaranteeAmount: z.number().min(0, 'El monto debe ser mayor o igual a 0').nullable().optional(),
  guaranteeCurrency: z.enum(['CLP', 'UF']).nullable().optional(),
}).refine(
  (data) => {
    const startDate = new Date(data.contractStartDate)
    const endDate = new Date(data.contractEndDate)
    return endDate > startDate
  },
  {
    message: 'La fecha de término debe ser posterior a la fecha de inicio',
    path: ['contractEndDate'],
  }
).refine(
  (data) => {
    // Si rentIncreaseType es ANNUAL, annualRentIncreasePercentage es requerido
    if (data.rentIncreaseType === 'ANNUAL') {
      return data.annualRentIncreasePercentage !== null && data.annualRentIncreasePercentage !== undefined
    }
    return true
  },
  {
    message: 'El porcentaje de aumento anual es requerido cuando se selecciona aumento anual',
    path: ['annualRentIncreasePercentage'],
  }
).refine(
  (data) => {
    // Si rentIncreaseType es SPECIFIC_DATES, rentIncreaseDates debe tener al menos una entrada
    if (data.rentIncreaseType === 'SPECIFIC_DATES') {
      return data.rentIncreaseDates && data.rentIncreaseDates.length > 0
    }
    return true
  },
  {
    message: 'Debe agregar al menos una fecha de aumento cuando se seleccionan fechas específicas',
    path: ['rentIncreaseDates'],
  }
).refine(
  (data) => {
    // La superficie total debe ser mayor o igual a la superficie de sala
    return data.surfaceAreaTotal >= data.surfaceAreaHall
  },
  {
    message: 'La superficie total debe ser mayor o igual a la superficie de sala',
    path: ['surfaceAreaTotal'],
  }
).refine(
  (data) => {
    // Si guaranteeType está definido, guaranteeAmount y guaranteeCurrency son requeridos
    if (data.guaranteeType) {
      return data.guaranteeAmount !== null && data.guaranteeAmount !== undefined &&
             data.guaranteeCurrency !== null && data.guaranteeCurrency !== undefined
    }
    return true
  },
  {
    message: 'El monto y moneda de la garantía son requeridos cuando se selecciona un tipo de garantía',
    path: ['guaranteeAmount'],
  }
)

export const storeFormSchema = z.object({
  storeName: z.string().min(1, 'El nombre de la tienda es requerido').max(200),
  banner: z.string().min(1, 'El banner es requerido').max(200),
  erpId: z.string().min(1, 'El ID del ERP es requerido').max(50, 'El ID del ERP debe tener máximo 50 caracteres').optional(),
  surfaceAreaHall: z.number().min(0, 'La superficie de sala debe ser mayor o igual a 0'),
  surfaceAreaTotal: z.number().min(0, 'La superficie total debe ser mayor o igual a 0'),
  shoppingCenterOperator: z.string().max(200).optional(),
  contractStartDate: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Fecha de inicio inválida'
  ),
  contractEndDate: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Fecha de término inválida'
  ),
  contractDuration: z.number().min(0),
  minimumMonthlyRent: z.number().min(0, 'El VMM debe ser mayor o igual a 0'),
  percentageRent: z.number().min(0).max(100, 'El porcentaje debe estar entre 0 y 100'),
  decemberFactor: z.number().min(0).max(10, 'El factor de diciembre debe estar entre 0 y 10'),
  commonExpenses: z.number().min(0, 'Los gastos comunes deben ser mayor o igual a 0'),
  promotionFund: z.number().min(0).max(100, 'El fondo de promoción debe estar entre 0 y 100'),
  notificationPeriodDays: z.number().min(0).max(365, 'Los días de notificación deben estar entre 0 y 365'),

  // Nuevos campos para renovación automática, aumentos y garantía
  autoRenewal: z.boolean().default(false),
  rentIncreaseType: z.enum([RentIncreaseType.ANNUAL, RentIncreaseType.SPECIFIC_DATES]).nullable().optional(),
  annualRentIncreasePercentage: z.number().min(0).max(1000, 'El porcentaje debe estar entre 0 y 1000').nullable().optional(),
  rentIncreaseDates: z.array(rentIncreaseDateSchema).optional(),
  guaranteeType: z.enum([GuaranteeType.CASH, GuaranteeType.BANK_GUARANTEE]).nullable().optional(),
  guaranteeAmount: z.number().min(0, 'El monto debe ser mayor o igual a 0').nullable().optional(),
  guaranteeCurrency: z.enum([Currency.CLP, Currency.UF]).nullable().optional(),
}).refine(
  (data) => {
    const startDate = new Date(data.contractStartDate)
    const endDate = new Date(data.contractEndDate)
    return endDate > startDate
  },
  {
    message: 'La fecha de término debe ser posterior a la fecha de inicio',
    path: ['contractEndDate'],
  }
).refine(
  (data) => {
    // Si rentIncreaseType es ANNUAL, annualRentIncreasePercentage es requerido
    if (data.rentIncreaseType === RentIncreaseType.ANNUAL) {
      return data.annualRentIncreasePercentage !== null && data.annualRentIncreasePercentage !== undefined
    }
    return true
  },
  {
    message: 'El porcentaje de aumento anual es requerido cuando se selecciona aumento anual',
    path: ['annualRentIncreasePercentage'],
  }
).refine(
  (data) => {
    // Si rentIncreaseType es SPECIFIC_DATES, rentIncreaseDates debe tener al menos una entrada
    if (data.rentIncreaseType === RentIncreaseType.SPECIFIC_DATES) {
      return data.rentIncreaseDates && data.rentIncreaseDates.length > 0
    }
    return true
  },
  {
    message: 'Debe agregar al menos una fecha de aumento cuando se seleccionan fechas específicas',
    path: ['rentIncreaseDates'],
  }
).refine(
  (data) => {
    // La superficie total debe ser mayor o igual a la superficie de sala
    return data.surfaceAreaTotal >= data.surfaceAreaHall
  },
  {
    message: 'La superficie total debe ser mayor o igual a la superficie de sala',
    path: ['surfaceAreaTotal'],
  }
).refine(
  (data) => {
    // Si guaranteeType está definido, guaranteeAmount y guaranteeCurrency son requeridos
    if (data.guaranteeType) {
      return data.guaranteeAmount !== null && data.guaranteeAmount !== undefined &&
             data.guaranteeCurrency !== null && data.guaranteeCurrency !== undefined
    }
    return true
  },
  {
    message: 'El monto y moneda de la garantía son requeridos cuando se selecciona un tipo de garantía',
    path: ['guaranteeAmount'],
  }
)

export type StoreFormInput = z.infer<typeof storeFormSchema>
export type CreateStoreInput = z.infer<typeof createStoreSchema>

/**
 * Schema de validación para crear una modificación temporal
 */
export const temporaryModificationSchema = z.object({
  startDate: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Fecha de inicio inválida'
  ),
  endDate: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    'Fecha de término inválida'
  ),
  minimumMonthlyRent: z.number().min(0, 'El VMM debe ser mayor o igual a 0'),
  percentageRent: z.number().min(0).max(100, 'El porcentaje debe estar entre 0 y 100'),
  decemberFactor: z.number().min(0).max(10, 'El factor de diciembre debe estar entre 0 y 10'),
}).refine(
  (data) => {
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)
    return endDate > startDate
  },
  {
    message: 'La fecha de término debe ser posterior a la fecha de inicio',
    path: ['endDate'],
  }
)

export type TemporaryModificationFormInput = z.infer<typeof temporaryModificationSchema>

