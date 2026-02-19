/**
 * Formatea una fecha para mostrar en la UI
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Obtiene el color de alerta según los días restantes
 */
export function getAlertColor(daysUntil: number): string {
  if (daysUntil < 0) return 'text-red-600'
  if (daysUntil <= 30) return 'text-red-500'
  if (daysUntil <= 90) return 'text-yellow-600'
  if (daysUntil <= 180) return 'text-yellow-500'
  return 'text-green-600'
}

/**
 * Formatea un número con formato chileno (punto para miles, coma para decimales)
 * Siempre muestra máximo 1 decimal si el número tiene decimales
 * @param value - El número a formatear
 * @returns El número formateado como string
 */
export function formatNumber(value: number): string {
  // Redondear a máximo 1 decimal
  const rounded = Math.round(value * 10) / 10
  const parts = rounded.toString().split('.')
  const integerPart = parts[0]
  const decimalPart = parts[1]
  
  // Agregar separadores de miles (puntos)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  
  // Si hay decimales, agregar coma y el decimal (máximo 1)
  if (decimalPart && decimalPart !== '0') {
    return `${formattedInteger},${decimalPart}`
  }
  
  return formattedInteger
}

/**
 * Formatea un número con decimales usando formato chileno
 * @deprecated Usar formatNumber en su lugar, que siempre muestra máximo 1 decimal
 * @param value - El número a formatear
 * @param decimals - Número de decimales (ignorado, siempre máximo 1)
 * @returns El número formateado como string
 */
export function formatDecimal(value: number, decimals: number = 1): string {
  return formatNumber(value)
}

