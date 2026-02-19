import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Verificar que la request viene de Vercel Cron
 */
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Si no hay CRON_SECRET configurado, permitir en desarrollo
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    return false
  }
  
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Función para obtener UF desde API externa (mindicador.cl)
 */
async function fetchUFFromAPI(date: Date): Promise<number | null> {
  try {
    // Formatear fecha como DD-MM-YYYY para mindicador.cl
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${day}-${month}-${year}`
    
    // Usar mindicador.cl API (gratuita, sin API key)
    const url = `https://mindicador.cl/api/uf/${dateStr}`
    const response = await fetch(url, { 
      next: { revalidate: 0 }, // No cache para cron job
      headers: {
        'Accept': 'application/json',
      }
    })
    
    if (!response.ok) {
      console.error(`Error fetching UF from API: ${response.status} ${response.statusText}`)
      return null
    }
    
    const data = await response.json()
    
    // mindicador.cl puede devolver diferentes estructuras:
    // 1. { serie: [{ fecha, valor }] } - para fechas específicas
    // 2. { valor: number } - para el valor actual
    // 3. { codigo, nombre, unidad_medida, fecha, valor } - estructura completa
    
    // Intentar diferentes estructuras de respuesta
    if (data.serie && Array.isArray(data.serie) && data.serie.length > 0) {
      const firstItem = data.serie[0]
      if (firstItem.valor !== undefined && firstItem.valor !== null) {
        const value = parseFloat(String(firstItem.valor))
        return value
      }
    }
    
    // Si tiene valor directo
    if (data.valor !== undefined && data.valor !== null) {
      const value = parseFloat(String(data.valor))
      return value
    }
    
    console.error('Estructura de respuesta inesperada de mindicador.cl')
    return null
  } catch (error) {
    console.error('Error fetching UF from API:', error)
    return null
  }
}

/**
 * Normalizar fecha (solo año-mes-día, sin hora)
 */
function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

/**
 * GET: Endpoint para cron job de Vercel
 * Actualiza el valor de UF del día actual y precarga valores históricos faltantes
 */
export async function GET(request: NextRequest) {
  // Verificar autorización
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    )
  }

  try {
    const today = normalizeDate(new Date())

    // 1. Obtener UF del día actual desde API externa
    const ufValue = await fetchUFFromAPI(today)
    
    if (ufValue === null) {
      return NextResponse.json(
        { 
          error: 'No se pudo obtener el valor de UF',
          date: today.toISOString().split('T')[0]
        },
        { status: 500 }
      )
    }

    // Guardar o actualizar valor del día actual en BD
    const savedValue = await prisma.uFValue.upsert({
      where: { date: today },
      update: { value: ufValue },
      create: {
        date: today,
        value: ufValue,
      },
    })

    // 2. Precargar valores históricos faltantes (últimos 365 días desde hoy hacia atrás)
    // 365 días = hoy + 364 días anteriores (365 días total incluyendo hoy)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364) // Restar 364 para incluir hoy

    // Obtener valores existentes en el rango
    const existingValues = await prisma.uFValue.findMany({
      where: {
        date: {
          gte: startDate,
          lte: today,
        },
      },
      select: {
        date: true,
      },
    })

    // Crear mapa de fechas existentes
    const existingDates = new Set(
      existingValues.map(v => v.date.toISOString().split('T')[0])
    )

    // Generar todas las fechas del rango
    const allDates: Date[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= today) {
      allDates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Buscar fechas faltantes
    const missingDates = allDates.filter(
      date => !existingDates.has(date.toISOString().split('T')[0])
    )

    // Precargar hasta 15 valores faltantes por ejecución (para no sobrecargar la API)
    const valuesToFetch = missingDates.slice(0, 15)
    let preloadedCount = 0

    for (const date of valuesToFetch) {
      const value = await fetchUFFromAPI(date)
      if (value !== null) {
        const normalizedDate = normalizeDate(date)
        await prisma.uFValue.upsert({
          where: { date: normalizedDate },
          update: { value },
          create: {
            date: normalizedDate,
            value,
          },
        })
        preloadedCount++
      }
      // Pequeña pausa para no sobrecargar la API externa
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    return NextResponse.json({
      success: true,
      date: savedValue.date.toISOString().split('T')[0],
      value: savedValue.value,
      updatedAt: savedValue.updatedAt.toISOString(),
      preloaded: preloadedCount,
      remaining: Math.max(0, missingDates.length - preloadedCount),
    })
  } catch (error) {
    console.error('Error in UF cron job:', error)
    return NextResponse.json(
      { 
        error: 'Error en cron job',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

