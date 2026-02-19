import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateContractDuration } from '@/lib/utils'
import { validateUserSession } from '@/lib/utils/user'
import { requireRole, UserRole } from '@/lib/utils/permissions'
import { AuditAction, SortField, SortOrder, StoreStatus } from '@/types/store'
import { getActiveModification, applyModification, cleanOperatorName, normalizeOperatorName } from '@/lib/utils/store'
import { createStoreSchema } from '@/lib/validations/store'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const expiringMonths = searchParams.get('expiringMonths')
    const operator = searchParams.get('operator')
    const surfaceMin = searchParams.get('surfaceMin')
    const surfaceMax = searchParams.get('surfaceMax')
    const vmmMin = searchParams.get('vmmMin')
    const vmmMax = searchParams.get('vmmMax')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const sortBy = searchParams.get('sortBy') as SortField | null
    const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'asc'

    const where: any = {}

    // Filtro por estado - por defecto excluir terminadas
    if (status) {
      // Si status es 'ALL', no filtrar por estado
      if (status !== 'ALL') {
        where.status = status
      }
    } else {
      // Si no se especifica status, excluir las terminadas por defecto
      where.status = 'ACTIVE'
    }

    // Búsqueda por texto
    if (search) {
      where.OR = [
        { storeName: { contains: search } },
        { banner: { contains: search } },
        { shoppingCenterOperator: { contains: search } },
        { erpId: { contains: search } },
      ]
    }

    // Filtro por operador
    if (operator) {
      where.shoppingCenterOperator = operator
    }

    // Filtro por superficie
    if (surfaceMin || surfaceMax) {
      where.surfaceAreaTotal = {}
      if (surfaceMin) {
        where.surfaceAreaTotal.gte = parseFloat(surfaceMin)
      }
      if (surfaceMax) {
        where.surfaceAreaTotal.lte = parseFloat(surfaceMax)
      }
    }

    // Filtro por VMM
    if (vmmMin || vmmMax) {
      where.minimumMonthlyRent = {}
      if (vmmMin) {
        where.minimumMonthlyRent.gte = parseFloat(vmmMin)
      }
      if (vmmMax) {
        where.minimumMonthlyRent.lte = parseFloat(vmmMax)
      }
    }

    // Filtro por fechas de término
    if (dateFrom || dateTo) {
      where.contractEndDate = {}
      if (dateFrom) {
        where.contractEndDate.gte = new Date(dateFrom)
      }
      if (dateTo) {
        const dateToEnd = new Date(dateTo)
        dateToEnd.setHours(23, 59, 59, 999)
        where.contractEndDate.lte = dateToEnd
      }
    }

    // Filtro por contratos próximos a vencer (mantener compatibilidad)
    if (expiringMonths) {
      const months = parseInt(expiringMonths)
      const today = new Date()
      const futureDate = new Date()
      futureDate.setMonth(today.getMonth() + months)
      where.contractEndDate = {
        gte: today,
        lte: futureDate,
      }
      where.status = 'ACTIVE'
    }

    // Validar y construir ordenamiento
    const validSortFields: SortField[] = [
      'storeName',
      'banner',
      'shoppingCenterOperator',
      'surfaceAreaTotal',
      'minimumMonthlyRent',
      'contractEndDate',
      'contractStartDate',
      'percentageRent',
      'createdAt',
      'updatedAt',
    ]

    let orderBy: any = { contractEndDate: 'asc' } // Default

    if (sortBy && validSortFields.includes(sortBy)) {
      orderBy = {
        [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
      }
    }

    const stores = await prisma.store.findMany({
      where,
      orderBy,
      include: {
        rentIncreaseDates: true,
      },
    })

    // Aplicar modificaciones activas a cada tienda
    const today = new Date()
    const storesWithModifications = await Promise.all(
      stores.map(async (store) => {
        try {
          // Obtener todas las modificaciones de la tienda
          const modifications = await prisma.temporaryModification.findMany({
            where: { storeId: store.id },
          })

          // Convertir fechas de Prisma a Date objects de JavaScript
          const modificationsWithDates = modifications.map((mod) => ({
            ...mod,
            startDate: new Date(mod.startDate),
            endDate: new Date(mod.endDate),
            createdAt: new Date(mod.createdAt),
            updatedAt: new Date(mod.updatedAt),
          }))

          // Obtener la modificación activa más reciente
          const activeModification = getActiveModification(modificationsWithDates, today)

          if (activeModification) {
            return applyModification(store as any, activeModification)
          }

          return store
        } catch (error) {
          // Si hay error al procesar modificaciones, retornar la tienda sin modificaciones
          console.error(`Error processing modifications for store ${store.id}:`, error)
          return store
        }
      })
    )

    return NextResponse.json(storesWithModifications)
  } catch (error) {
    console.error('Error fetching stores:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { 
        error: 'Error al obtener las tiendas',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = await validateUserSession(session)

    // Verificar permisos - solo GESTOR o ADMINISTRADOR pueden crear tiendas
    requireRole(session, UserRole.GESTOR)

    const body = await request.json()

    // Validar datos con Zod
    let validatedData
    try {
      validatedData = createStoreSchema.parse(body)
    } catch (error: any) {
      // Extraer el primer error de validación para mostrarlo
      const firstError = error.errors?.[0]
      const errorMessage = firstError?.message || 'Datos de formulario inválidos'

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    const {
      storeName,
      banner,
      erpId,
      surfaceAreaHall,
      surfaceAreaTotal,
      shoppingCenterOperator,
      contractStartDate,
      contractEndDate,
      minimumMonthlyRent,
      percentageRent,
      decemberFactor,
      commonExpenses,
      promotionFund,
      notificationPeriodDays,
      // Nuevos campos para renovación automática, aumentos y garantía
      autoRenewal,
      rentIncreaseType,
      annualRentIncreasePercentage,
      rentIncreaseDates,
      guaranteeType,
      guaranteeAmount,
      guaranteeCurrency,
    } = validatedData

    const startDate = new Date(contractStartDate)
    const endDate = new Date(contractEndDate)

    const contractDuration = calculateContractDuration(startDate, endDate)

    // Validar unicidad del erpId
    const existingStore = await prisma.store.findUnique({
      where: { erpId },
    })

    if (existingStore) {
      return NextResponse.json(
        { error: 'Ya existe una tienda con este ID del ERP' },
        { status: 409 }
      )
    }

    const cleanedOperator = cleanOperatorName(shoppingCenterOperator)

    // Ejecutar todas las operaciones en una transacción para asegurar atomicidad
    const result = await prisma.$transaction(async (tx) => {
      const canonicalOperator =
        cleanedOperator === ''
          ? ''
          : await (async () => {
              const existingOperators = await tx.store.findMany({
                where: {
                  shoppingCenterOperator: {
                    not: '',
                  },
                },
                select: {
                  shoppingCenterOperator: true,
                },
                orderBy: {
                  shoppingCenterOperator: 'asc',
                },
              })

              const inputNormalized = normalizeOperatorName(cleanedOperator)
              const existingMatch = existingOperators.find(
                (row) => normalizeOperatorName(row.shoppingCenterOperator) === inputNormalized
              )

              return existingMatch ? cleanOperatorName(existingMatch.shoppingCenterOperator) : cleanedOperator
            })()

      // Crear tienda
      const store = await tx.store.create({
        data: {
          storeName,
          banner,
          erpId,
          surfaceAreaHall: surfaceAreaHall || 0,
          surfaceAreaTotal: surfaceAreaTotal || 0,
          shoppingCenterOperator: canonicalOperator,
          contractStartDate: startDate,
          contractEndDate: endDate,
          contractDuration,
          minimumMonthlyRent: minimumMonthlyRent || 0,
          percentageRent: percentageRent || 0,
          decemberFactor: decemberFactor ?? 1,
          commonExpenses: commonExpenses || 0,
          promotionFund: promotionFund || 0,
          notificationPeriodDays: notificationPeriodDays || 0,
          status: StoreStatus.ACTIVE,
          // Nuevos campos para renovación automática, aumentos y garantía
          autoRenewal: autoRenewal || false,
          rentIncreaseType,
          annualRentIncreasePercentage: annualRentIncreasePercentage ?? null,
          guaranteeType,
          guaranteeAmount: guaranteeAmount ?? null,
          guaranteeCurrency,
        },
      })

      // Crear fechas de aumento específicas si existen
      if (rentIncreaseDates && Array.isArray(rentIncreaseDates) && rentIncreaseDates.length > 0) {
        await tx.rentIncreaseDate.createMany({
          data: rentIncreaseDates.map((date: any) => ({
            storeId: store.id,
            increaseDate: new Date(date.increaseDate),
            increasePercentage: date.increasePercentage || 0,
          })),
        })
      }

      // Registrar en audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          storeId: store.id,
          action: AuditAction.CREATE,
          fieldChanged: null,
          oldValue: null,
          newValue: null,
        },
      })

      return store
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating store:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    
    // Handle Prisma validation errors
    if (errorMessage.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Ya existe una tienda con estos datos' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Error al crear la tienda',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
