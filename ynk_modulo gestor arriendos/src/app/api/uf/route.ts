import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    // Formato: https://mindicador.cl/api/uf/DD-MM-YYYY
    const url = `https://mindicador.cl/api/uf/${dateStr}`
    console.log('Fetching UF from:', url)
    
    const response = await fetch(url, { 
      next: { revalidate: 3600 }, // Cache por 1 hora
      headers: {
        'Accept': 'application/json',
      }
    })
    
    if (!response.ok) {
      console.error(`Error fetching UF from API: ${response.status} ${response.statusText}`)
      const text = await response.text().catch(() => '')
      console.error('Response body:', text)
      return null
    }
    
    const data = await response.json()
    console.log('API Response structure:', Object.keys(data))
    
    // mindicador.cl puede devolver diferentes estructuras:
    // 1. { serie: [{ fecha, valor }] } - para fechas específicas
    // 2. { valor: number } - para el valor actual
    // 3. { codigo, nombre, unidad_medida, fecha, valor } - estructura completa
    
    // Intentar diferentes estructuras de respuesta
    if (data.serie && Array.isArray(data.serie) && data.serie.length > 0) {
      const firstItem = data.serie[0]
      if (firstItem.valor !== undefined && firstItem.valor !== null) {
        const value = parseFloat(String(firstItem.valor))
        console.log('UF value from serie:', value)
        return value
      }
    }
    
    // Si tiene valor directo
    if (data.valor !== undefined && data.valor !== null) {
      const value = parseFloat(String(data.valor))
      console.log('UF value direct:', value)
      return value
    }
    
    console.error('Estructura de respuesta inesperada de mindicador.cl:', JSON.stringify(data, null, 2))
    return null
  } catch (error) {
    console.error('Error fetching UF from API:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
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
 * GET: Obtener UF del día actual o de una fecha específica
 * Query params:
 * - date: fecha específica (YYYY-MM-DD)
 * - range: número de días para obtener historial (ej: 365)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date')
    const rangeParam = searchParams.get('range')

    // Si se solicita un rango de fechas
    if (rangeParam) {
      const days = parseInt(rangeParam, 10)
      if (isNaN(days) || days < 1 || days > 365) {
        return NextResponse.json(
          { error: 'El rango debe ser un número entre 1 y 365' },
          { status: 400 }
        )
      }

      // Calcular rango desde hoy hacia atrás
      // Ejemplo: 30 días = hoy + 29 días anteriores (30 días total incluyendo hoy)
      const today = normalizeDate(new Date())
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - (days - 1)) // Restar (days - 1) para incluir hoy

      // Obtener solo valores almacenados en la BD (sin intentar obtener valores faltantes)
      // La precarga de valores históricos se hace de forma asíncrona mediante el cron job
      const allValues = await prisma.uFValue.findMany({
        where: {
          date: {
            gte: startDate, // Desde startDate (hace X días)
            lte: today,     // Hasta hoy (inclusive)
          },
        },
        orderBy: {
          date: 'asc',
        },
      })

      return NextResponse.json({
        data: allValues.map(v => ({
          date: v.date.toISOString().split('T')[0],
          value: v.value,
        })),
        count: allValues.length,
      })
    }

    // Obtener valor de una fecha específica o del día actual
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    const normalizedDate = normalizeDate(targetDate)

    // Buscar en BD
    let ufValue = await prisma.uFValue.findUnique({
      where: { date: normalizedDate },
    })

    // Si no existe o es de hoy y no se ha actualizado hoy, obtener del API
    const today = normalizeDate(new Date())
    const isToday = normalizedDate.getTime() === today.getTime()

    if (!ufValue || (isToday && ufValue.updatedAt < today)) {
      const newValue = await fetchUFFromAPI(normalizedDate)

      if (newValue !== null) {
        // Upsert: crear o actualizar
        ufValue = await prisma.uFValue.upsert({
          where: { date: normalizedDate },
          update: { value: newValue },
          create: {
            date: normalizedDate,
            value: newValue,
          },
        })
      } else if (!ufValue) {
        // Si no se pudo obtener y no hay valor en BD, devolver error
        return NextResponse.json(
          { error: 'No se pudo obtener el valor de la UF' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      date: ufValue.date.toISOString().split('T')[0],
      value: ufValue.value,
      updatedAt: ufValue.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error fetching UF:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    const errorDetails = process.env.NODE_ENV === 'development' ? errorMessage : undefined
    return NextResponse.json(
      { 
        error: 'Error al obtener UF',
        details: errorDetails
      },
      { status: 500 }
    )
  }
}

/**
 * POST: Forzar actualización manual (opcional, para admin)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { date } = body
    const targetDate = date ? new Date(date) : new Date()
    const normalizedDate = normalizeDate(targetDate)

    const newValue = await fetchUFFromAPI(normalizedDate)

    if (newValue === null) {
      return NextResponse.json(
        { error: 'No se pudo obtener el valor de la UF' },
        { status: 500 }
      )
    }

    const ufValue = await prisma.uFValue.upsert({
      where: { date: normalizedDate },
      update: { value: newValue },
      create: {
        date: normalizedDate,
        value: newValue,
      },
    })

    return NextResponse.json({
      date: ufValue.date.toISOString().split('T')[0],
      value: ufValue.value,
      updatedAt: ufValue.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error updating UF:', error)
    return NextResponse.json(
      { error: 'Error al actualizar UF' },
      { status: 500 }
    )
  }
}

/**
 * PUT: Precargar valores históricos faltantes para un rango
 * Soporta precarga completa o incremental por batches
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { range, batchSize = 10, startFrom = 0 } = body
    const days = range ? parseInt(range, 10) : 365

    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'El rango debe ser un número entre 1 y 365' },
        { status: 400 }
      )
    }

    // Calcular rango desde hoy hacia atrás
    // Ejemplo: 30 días = hoy + 29 días anteriores (30 días total incluyendo hoy)
    const today = normalizeDate(new Date())
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - (days - 1)) // Restar (days - 1) para incluir hoy

    // Obtener valores existentes en el rango [startDate, today]
    const existingValues = await prisma.uFValue.findMany({
      where: {
        date: {
          gte: startDate, // Desde startDate (hace X días)
          lte: today,     // Hasta hoy (inclusive)
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

    // Generar todas las fechas del rango desde startDate hasta today (inclusive)
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

    const totalMissing = missingDates.length

    // Si no hay valores faltantes, retornar inmediatamente
    if (totalMissing === 0) {
      return NextResponse.json({
        success: true,
        loaded: 0,
        errors: 0,
        remaining: 0,
        total: 0,
        progress: 100,
        completed: true,
      })
    }

    // Si se especifica batchSize, procesar solo un batch para progreso incremental
    if (batchSize && batchSize > 0) {
      const batch = missingDates.slice(startFrom, startFrom + batchSize)
      let loadedCount = 0
      let errorCount = 0

      for (const date of batch) {
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
          loadedCount++
        } else {
          errorCount++
        }
        // Pequeña pausa para no sobrecargar la API externa
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      const processedSoFar = startFrom + batch.length
      const remaining = Math.max(0, totalMissing - processedSoFar)
      const progress = Math.round((processedSoFar / totalMissing) * 100)

      return NextResponse.json({
        success: true,
        loaded: loadedCount,
        errors: errorCount,
        remaining,
        total: totalMissing,
        progress,
        completed: remaining === 0,
        nextStartFrom: processedSoFar,
      })
    }

    // Precarga completa (comportamiento original) - procesar todos de una vez
    let loadedCount = 0
    let errorCount = 0

    // Procesar todos los valores faltantes de una sola vez con concurrencia para ser más rápido
    const CONCURRENT_REQUESTS = 5 // Máximo 5 requests simultáneas para evitar rate limits

    for (let i = 0; i < missingDates.length; i += CONCURRENT_REQUESTS) {
      const batch = missingDates.slice(i, i + CONCURRENT_REQUESTS)

      // Procesar batch en paralelo
      const promises = batch.map(async (date) => {
        try {
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
            return 1 // éxito
          } else {
            return 0 // error
          }
        } catch (error) {
          console.error(`Error fetching UF for date ${date.toISOString().split('T')[0]}:`, error)
          return 0 // error
        }
      })

      // Esperar a que termine el batch
      const results = await Promise.all(promises)
      const batchLoaded = results.reduce<number>((sum, result) => sum + result, 0)
      loadedCount += batchLoaded
      errorCount += CONCURRENT_REQUESTS - batchLoaded

      // Pequeña pausa entre batches para no sobrecargar la API externa
      if (i + CONCURRENT_REQUESTS < missingDates.length) {
        await new Promise(resolve => setTimeout(resolve, 30))
      }
    }

    return NextResponse.json({
      success: true,
      loaded: loadedCount,
      errors: errorCount,
      remaining: 0, // Ya se cargaron todos
      total: totalMissing,
      progress: 100,
      completed: true,
    })
  } catch (error) {
    console.error('Error precargando valores históricos:', error)
    return NextResponse.json(
      {
        error: 'Error al precargar valores históricos',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Borrar y resincronizar completamente los valores históricos de UF
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const rangeParam = searchParams.get('range')
    const days = rangeParam ? parseInt(rangeParam, 10) : 365

    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'El rango debe ser un número entre 1 y 365' },
        { status: 400 }
      )
    }

    // Calcular rango desde hoy hacia atrás
    const today = normalizeDate(new Date())
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - (days - 1)) // Restar (days - 1) para incluir hoy

    // Contar valores existentes antes de borrar
    const existingCount = await prisma.uFValue.count({
      where: {
        date: {
          gte: startDate,
          lte: today,
        },
      },
    })

    // Borrar todos los valores en el rango
    await prisma.uFValue.deleteMany({
      where: {
        date: {
          gte: startDate,
          lte: today,
        },
      },
    })

    // Resincronizar desde cero (procesar todos los valores)
    let loadedCount = 0
    let errorCount = 0

    // Generar todas las fechas del rango
    const allDates: Date[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= today) {
      allDates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Procesar en batches para no sobrecargar la API
    const BATCH_SIZE = 20
    for (let i = 0; i < allDates.length; i += BATCH_SIZE) {
      const batch = allDates.slice(i, i + BATCH_SIZE)

      for (const date of batch) {
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
          loadedCount++
        } else {
          errorCount++
        }
        // Pequeña pausa para no sobrecargar la API externa
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    return NextResponse.json({
      success: true,
      deleted: existingCount,
      loaded: loadedCount,
      errors: errorCount,
    })
  } catch (error) {
    console.error('Error resincronizando valores históricos:', error)
    return NextResponse.json(
      {
        error: 'Error al resincronizar valores históricos',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
