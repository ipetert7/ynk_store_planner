import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateContractDuration } from '@/lib/utils'
import { validateUserSession } from '@/lib/utils/user'
import { requireRole, UserRole } from '@/lib/utils/permissions'
import { StoreStatus, AuditAction, StoreFormData } from '@/types/store'
import type { Store } from '@prisma/client'

interface ProcessRequest {
  rows: Array<{ row: number; data: StoreFormData }>
  duplicateDecisions: Record<string, 'update' | 'skip'> // erpId -> acción
}

interface ProcessResult {
  success: number
  failed: number
  updated: number
  created: number
  skipped: number
  errors: Array<{ row: number; erpId?: string; error: string }>
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = await validateUserSession(session)

    // Verificar permisos - solo GESTOR o ADMINISTRADOR pueden importar
    requireRole(session, UserRole.GESTOR)

    const body: ProcessRequest = await request.json()
    const { rows, duplicateDecisions } = body

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Datos de filas inválidos' },
        { status: 400 }
      )
    }

    if (!duplicateDecisions || typeof duplicateDecisions !== 'object') {
      return NextResponse.json(
        { error: 'Decisiones de duplicados inválidas' },
        { status: 400 }
      )
    }

    const result: ProcessResult = {
      success: 0,
      failed: 0,
      updated: 0,
      created: 0,
      skipped: 0,
      errors: []
    }

    // Obtener IDs de ERP existentes para validar duplicados
    const existingStores = await prisma.store.findMany({
      select: { erpId: true, id: true }
    })
    const existingErpIds = new Set(existingStores.map(store => store.erpId))

    // Procesar cada fila
    for (const rowData of rows) {
      const { row, data } = rowData

      try {
        const erpId = data.erpId

        // Verificar si es un duplicado y qué acción tomar
        const isDuplicate = existingErpIds.has(erpId)
        const decision = duplicateDecisions[erpId]

        if (isDuplicate && decision === 'skip') {
          result.skipped++
          continue
        }

        // Preparar datos para Prisma
        const startDate = new Date(data.contractStartDate)
        const endDate = new Date(data.contractEndDate)

        // Validar que las fechas sean válidas
        if (isNaN(startDate.getTime())) {
          throw new Error(`Fecha de inicio inválida: ${data.contractStartDate}`)
        }
        if (isNaN(endDate.getTime())) {
          throw new Error(`Fecha de término inválida: ${data.contractEndDate}`)
        }

        const contractDuration = calculateContractDuration(startDate, endDate)

        // Ejecutar en transacción
        await prisma.$transaction(async (tx) => {
          let store: Store

          if (isDuplicate && decision === 'update') {
            // Actualizar tienda existente
            const existingStore = existingStores.find(s => s.erpId === erpId)
            if (!existingStore) {
              throw new Error(`Tienda con ERP ID ${erpId} no encontrada para actualizar`)
            }

            store = await tx.store.update({
              where: { id: existingStore.id },
              data: {
                storeName: data.storeName,
                banner: data.banner,
                surfaceAreaHall: data.surfaceAreaHall || 0,
                surfaceAreaTotal: data.surfaceAreaTotal || 0,
                shoppingCenterOperator: data.shoppingCenterOperator ?? '',
                contractStartDate: startDate,
                contractEndDate: endDate,
                contractDuration,
                minimumMonthlyRent: data.minimumMonthlyRent || 0,
                percentageRent: data.percentageRent || 0,
                decemberFactor: data.decemberFactor ?? 1,
                commonExpenses: data.commonExpenses || 0,
                promotionFund: data.promotionFund || 0,
                notificationPeriodDays: data.notificationPeriodDays || 0,
                autoRenewal: data.autoRenewal || false,
                rentIncreaseType: data.rentIncreaseType ?? null,
                annualRentIncreasePercentage: data.annualRentIncreasePercentage ?? null,
                guaranteeType: data.guaranteeType ?? null,
                guaranteeAmount: data.guaranteeAmount ?? null,
                guaranteeCurrency: data.guaranteeCurrency ?? null,
              },
            })

            // Eliminar fechas de aumento específicas existentes y crear nuevas
            await tx.rentIncreaseDate.deleteMany({
              where: { storeId: store.id }
            })

            if (data.rentIncreaseDates && data.rentIncreaseDates.length > 0) {
              await tx.rentIncreaseDate.createMany({
                data: data.rentIncreaseDates.map((date) => ({
                  storeId: store.id,
                  increaseDate: new Date(date.increaseDate),
                  increasePercentage: date.increasePercentage || 0,
                })),
              })
            }

            result.updated++

            // Registrar en audit log
            await tx.auditLog.create({
              data: {
                userId: user.id,
                storeId: store.id,
                action: AuditAction.UPDATE,
                fieldChanged: null,
                oldValue: null,
                newValue: null,
              },
            })

          } else {
            // Crear nueva tienda
            store = await tx.store.create({
              data: {
                erpId: data.erpId,
                storeName: data.storeName,
                banner: data.banner,
                surfaceAreaHall: data.surfaceAreaHall || 0,
                surfaceAreaTotal: data.surfaceAreaTotal || 0,
                shoppingCenterOperator: data.shoppingCenterOperator ?? '',
                contractStartDate: startDate,
                contractEndDate: endDate,
                contractDuration,
                minimumMonthlyRent: data.minimumMonthlyRent || 0,
                percentageRent: data.percentageRent || 0,
                decemberFactor: data.decemberFactor ?? 1,
                commonExpenses: data.commonExpenses || 0,
                promotionFund: data.promotionFund || 0,
                notificationPeriodDays: data.notificationPeriodDays || 0,
                status: StoreStatus.ACTIVE,
                autoRenewal: data.autoRenewal || false,
                rentIncreaseType: data.rentIncreaseType ?? null,
                annualRentIncreasePercentage: data.annualRentIncreasePercentage ?? null,
                guaranteeType: data.guaranteeType ?? null,
                guaranteeAmount: data.guaranteeAmount ?? null,
                guaranteeCurrency: data.guaranteeCurrency ?? null,
              },
            })

            // Crear fechas de aumento específicas si existen
            if (data.rentIncreaseDates && data.rentIncreaseDates.length > 0) {
              await tx.rentIncreaseDate.createMany({
                data: data.rentIncreaseDates.map((date) => ({
                  storeId: store.id,
                  increaseDate: new Date(date.increaseDate),
                  increasePercentage: date.increasePercentage || 0,
                })),
              })
            }

            result.created++

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
          }
        })

        result.success++

      } catch (error: any) {
        result.failed++
        const errorMessage = error.errors?.[0]?.message || error.message || 'Error desconocido'
        result.errors.push({
          row,
          erpId: data.erpId,
          error: errorMessage
        })
        console.error(`Error procesando fila ${row}:`, error)
      }
    }

    return NextResponse.json(result, { status: 200 })

  } catch (error) {
    console.error('Error processing bulk import:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

    return NextResponse.json(
      {
        error: 'Error al procesar la importación masiva',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
