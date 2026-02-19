/**
 * Calcula los días hasta una fecha específica
 */
export function calculateDaysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)
  const diffTime = targetDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Verifica si un contrato vence en los próximos X meses
 */
export function isContractExpiring(endDate: Date, months: number): boolean {
  const today = new Date()
  const targetDate = new Date(endDate)
  const monthsUntilExpiry = 
    (targetDate.getFullYear() - today.getFullYear()) * 12 +
    (targetDate.getMonth() - today.getMonth())
  
  return monthsUntilExpiry >= 0 && monthsUntilExpiry <= months
}

/**
 * Calcula la duración del contrato en meses basado en las fechas
 */
export function calculateContractDuration(startDate: Date, endDate: Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const months = 
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  return months
}

