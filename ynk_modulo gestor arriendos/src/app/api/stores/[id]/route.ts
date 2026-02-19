import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateContractDuration } from '@/lib/utils'
import { validateUserSession } from '@/lib/utils/user'
import { requireRole, UserRole } from '@/lib/utils/permissions'
import { AuditAction } from '@/types/store'
import { getActiveModification, applyModification } from '@/lib/utils/store'
import { storeService } from '@/services/store.service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const applyModificationsParam = request.nextUrl.searchParams.get('applyModifications')
    const shouldApplyModifications = applyModificationsParam !== 'false'

    const store = await storeService.getById(params.id, { applyModifications: shouldApplyModifications })

    if (!store) {
      return NextResponse.json(
        { error: 'Tienda no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(store)
  } catch (error) {
    console.error('Error fetching store:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      {
        error: 'Error al obtener la tienda',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = await validateUserSession(session)

    // Verificar permisos - solo GESTOR o ADMINISTRADOR pueden editar tiendas
    requireRole(session, UserRole.GESTOR)

    const store = await prisma.store.findUnique({
      where: { id: params.id },
    })

    if (!store) {
      return NextResponse.json(
        { error: 'Tienda no encontrada' },
        { status: 404 }
      )
    }

    if (store.status === 'TERMINATED') {
      return NextResponse.json(
        { error: 'No se puede editar un contrato terminado' },
        { status: 400 }
      )
    }

    const body = await request.json()
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
    } = body

    // Validar unicidad del erpId si se está cambiando
    if (erpId !== undefined && erpId !== store.erpId) {
      const existingStore = await prisma.store.findUnique({
        where: { erpId },
      })

      if (existingStore) {
        return NextResponse.json(
          { error: 'Ya existe una tienda con este ID del ERP' },
          { status: 409 }
        )
      }
    }

    // Preparar datos de actualización
    const updateData: any = {}
    const auditLogs: any[] = []

    // Función helper para registrar cambios
    const trackChange = (field: string, oldValue: any, newValue: any) => {
      // Comparar fechas usando timestamps para evitar falsos positivos
      let hasChanged = false
      if (oldValue instanceof Date && newValue instanceof Date) {
        hasChanged = oldValue.getTime() !== newValue.getTime()
      } else {
        hasChanged = oldValue !== newValue
      }

      if (hasChanged) {
        updateData[field] = newValue
        // Formatear fechas de manera consistente para el audit log
        const formatValue = (value: any) => {
          if (value instanceof Date) {
            return value.toISOString()
          }
          return String(value)
        }
        auditLogs.push({
          userId: user.id,
          storeId: params.id,
          action: AuditAction.UPDATE,
          fieldChanged: field,
          oldValue: formatValue(oldValue),
          newValue: formatValue(newValue),
        })
      }
    }

    if (storeName !== undefined) trackChange('storeName', store.storeName, storeName)
    if (banner !== undefined) trackChange('banner', store.banner, banner)
    if (erpId !== undefined) trackChange('erpId', store.erpId, erpId)
    if (surfaceAreaHall !== undefined) trackChange('surfaceAreaHall', store.surfaceAreaHall, parseFloat(surfaceAreaHall))
    if (surfaceAreaTotal !== undefined) trackChange('surfaceAreaTotal', store.surfaceAreaTotal, parseFloat(surfaceAreaTotal))
    if (shoppingCenterOperator !== undefined) trackChange('shoppingCenterOperator', store.shoppingCenterOperator, shoppingCenterOperator)
    if (minimumMonthlyRent !== undefined) trackChange('minimumMonthlyRent', store.minimumMonthlyRent, parseFloat(minimumMonthlyRent))
    if (percentageRent !== undefined) trackChange('percentageRent', store.percentageRent, parseFloat(percentageRent))
    if (decemberFactor !== undefined) trackChange('decemberFactor', store.decemberFactor, parseFloat(decemberFactor))
    if (commonExpenses !== undefined) trackChange('commonExpenses', store.commonExpenses, parseFloat(commonExpenses))
    if (promotionFund !== undefined) trackChange('promotionFund', store.promotionFund, parseFloat(promotionFund))
    if (notificationPeriodDays !== undefined) trackChange('notificationPeriodDays', store.notificationPeriodDays, parseInt(notificationPeriodDays))

    // Tracking para nuevos campos
    if (autoRenewal !== undefined) trackChange('autoRenewal', store.autoRenewal, autoRenewal)
    if (rentIncreaseType !== undefined) trackChange('rentIncreaseType', store.rentIncreaseType, rentIncreaseType)
    if (annualRentIncreasePercentage !== undefined) trackChange('annualRentIncreasePercentage', store.annualRentIncreasePercentage, annualRentIncreasePercentage !== null ? parseFloat(annualRentIncreasePercentage) : null)
    if (guaranteeType !== undefined) trackChange('guaranteeType', store.guaranteeType, guaranteeType)
    if (guaranteeAmount !== undefined) trackChange('guaranteeAmount', store.guaranteeAmount, guaranteeAmount !== null ? parseFloat(guaranteeAmount) : null)
    if (guaranteeCurrency !== undefined) trackChange('guaranteeCurrency', store.guaranteeCurrency, guaranteeCurrency)

    // Manejar fechas
    if (contractStartDate || contractEndDate) {
      const startDate = contractStartDate ? new Date(contractStartDate) : store.contractStartDate
      const endDate = contractEndDate ? new Date(contractEndDate) : store.contractEndDate

      if (endDate <= startDate) {
        return NextResponse.json(
          { error: 'La fecha de término debe ser posterior a la fecha de inicio' },
          { status: 400 }
        )
      }

      if (contractStartDate) trackChange('contractStartDate', store.contractStartDate, startDate)
      if (contractEndDate) trackChange('contractEndDate', store.contractEndDate, endDate)

      if (contractStartDate || contractEndDate) {
        const contractDuration = calculateContractDuration(startDate, endDate)
        trackChange('contractDuration', store.contractDuration, contractDuration)
      }
    }

    // Actualizar tienda
    const updatedStore = await prisma.store.update({
      where: { id: params.id },
      data: updateData,
    })

    // Registrar cambios en audit log
    if (auditLogs.length > 0) {
      await prisma.auditLog.createMany({
        data: auditLogs,
      })
    }

    // Sincronizar fechas de aumento específicas
    if (rentIncreaseDates !== undefined) {
      // Obtener fechas de aumento actuales
      const currentRentIncreaseDates = await prisma.rentIncreaseDate.findMany({
        where: { storeId: params.id },
      })

      // Crear mapa de fechas actuales por ID
      const currentDatesMap = new Map(currentRentIncreaseDates.map(date => [date.id, date]))

      // Procesar fechas del request
      const requestDatesMap = new Map(
        (rentIncreaseDates || []).filter((date: any) => date.id).map((date: any) => [date.id, date])
      )

      // Fechas a crear (no tienen ID)
      const datesToCreate = (rentIncreaseDates || []).filter((date: any) => !date.id)

      // Fechas a actualizar (tienen ID y existen en current)
      const datesToUpdate = (rentIncreaseDates || [])
        .filter((date: any) => date.id && currentDatesMap.has(date.id))

      // IDs a eliminar (existen en current pero no en request)
      const idsToDelete = currentRentIncreaseDates
        .filter(date => !requestDatesMap.has(date.id))
        .map(date => date.id)

      // Ejecutar operaciones en transacción
      await prisma.$transaction(async (tx) => {
        // Crear nuevas fechas
        if (datesToCreate.length > 0) {
          await tx.rentIncreaseDate.createMany({
            data: datesToCreate.map((date: any) => ({
              storeId: params.id,
              increaseDate: new Date(date.increaseDate),
              increasePercentage: parseFloat(date.increasePercentage) || 0,
            })),
          })
        }

        // Actualizar fechas existentes
        for (const date of datesToUpdate) {
          const currentDate = currentDatesMap.get(date.id)
          if (currentDate) {
            const newIncreaseDate = new Date(date.increaseDate)
            const newIncreasePercentage = parseFloat(date.increasePercentage) || 0

            if (
              currentDate.increaseDate.getTime() !== newIncreaseDate.getTime() ||
              currentDate.increasePercentage !== newIncreasePercentage
            ) {
              await tx.rentIncreaseDate.update({
                where: { id: date.id },
                data: {
                  increaseDate: newIncreaseDate,
                  increasePercentage: newIncreasePercentage,
                },
              })
            }
          }
        }

        // Eliminar fechas que ya no existen
        if (idsToDelete.length > 0) {
          await tx.rentIncreaseDate.deleteMany({
            where: {
              id: { in: idsToDelete },
            },
          })
        }
      })
    }

    return NextResponse.json(updatedStore)
  } catch (error) {
    console.error('Error updating store:', error)
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
        error: 'Error al actualizar la tienda',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el usuario existe en la base de datos
    const user = await validateUserSession(session)

    // Verificar permisos - solo GESTOR o ADMINISTRADOR pueden terminar contratos
    requireRole(session, UserRole.GESTOR)

    const store = await prisma.store.findUnique({
      where: { id: params.id },
    })

    if (!store) {
      return NextResponse.json(
        { error: 'Tienda no encontrada' },
        { status: 404 }
      )
    }

    if (store.status === 'TERMINATED') {
      return NextResponse.json(
        { error: 'El contrato ya está cerrado' },
        { status: 400 }
      )
    }

    // Soft delete: cambiar status a TERMINATED
    const updatedStore = await prisma.store.update({
      where: { id: params.id },
      data: { status: 'TERMINATED' },
    })

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        storeId: params.id,
        action: AuditAction.TERMINATE,
        fieldChanged: 'status',
        oldValue: store.status,
        newValue: 'TERMINATED',
      },
    })

    return NextResponse.json(updatedStore)
  } catch (error) {
    console.error('Error terminating store:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      {
        error: 'Error al cerrar el contrato',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
