import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateUserSession } from '@/lib/utils/user'
import { requireRole, UserRole } from '@/lib/utils/permissions'
import { AuditAction } from '@/types/store'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que la tienda existe
    const store = await prisma.store.findUnique({
      where: { id: params.id },
    })

    if (!store) {
      return NextResponse.json(
        { error: 'Tienda no encontrada' },
        { status: 404 }
      )
    }

    // Obtener todas las modificaciones de la tienda
    const modifications = await prisma.temporaryModification.findMany({
      where: { storeId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(modifications)
  } catch (error) {
    console.error('Error fetching modifications:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { 
        error: 'Error al obtener las modificaciones',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = await validateUserSession(session)

    // Verificar permisos - solo GESTOR o ADMINISTRADOR pueden crear modificaciones
    requireRole(session, UserRole.GESTOR)

    // Verificar que la tienda existe
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
        { error: 'No se pueden crear modificaciones para contratos terminados' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      startDate,
      endDate,
      minimumMonthlyRent,
      percentageRent,
      decemberFactor,
    } = body

    // Validaciones
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Las fechas de inicio y término son requeridas' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end <= start) {
      return NextResponse.json(
        { error: 'La fecha de término debe ser posterior a la fecha de inicio' },
        { status: 400 }
      )
    }

    if (start < store.contractStartDate || end > store.contractEndDate) {
      return NextResponse.json(
        { error: 'El período debe estar dentro de las fechas del contrato' },
        { status: 400 }
      )
    }

    const overlappingModification = await prisma.temporaryModification.findFirst({
      where: {
        storeId: params.id,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    })

    if (overlappingModification) {
      return NextResponse.json(
        { error: 'Ya existe una modificación que se superpone con este período' },
        { status: 400 }
      )
    }

    if (minimumMonthlyRent === undefined || minimumMonthlyRent < 0) {
      return NextResponse.json(
        { error: 'El VMM debe ser mayor o igual a 0' },
        { status: 400 }
      )
    }

    if (percentageRent === undefined || percentageRent < 0 || percentageRent > 100) {
      return NextResponse.json(
        { error: 'El porcentaje de arriendo debe estar entre 0 y 100' },
        { status: 400 }
      )
    }

    if (decemberFactor === undefined || decemberFactor < 0 || decemberFactor > 10) {
      return NextResponse.json(
        { error: 'El factor de diciembre debe estar entre 0 y 10' },
        { status: 400 }
      )
    }

    // Guardar valores originales
    const originalMinimumMonthlyRent = store.minimumMonthlyRent
    const originalPercentageRent = store.percentageRent
    const originalDecemberFactor = store.decemberFactor

    // Crear modificación temporal
    const modification = await prisma.temporaryModification.create({
      data: {
        storeId: params.id,
        startDate: start,
        endDate: end,
        minimumMonthlyRent: parseFloat(minimumMonthlyRent),
        percentageRent: parseFloat(percentageRent),
        decemberFactor: parseFloat(decemberFactor),
        originalMinimumMonthlyRent,
        originalPercentageRent,
        originalDecemberFactor,
      },
    })

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        storeId: params.id,
        action: AuditAction.CREATE_TEMPORARY_MODIFICATION,
        fieldChanged: 'temporary_modification',
        oldValue: null,
        newValue: JSON.stringify({
          startDate: modification.startDate.toISOString(),
          endDate: modification.endDate.toISOString(),
          minimumMonthlyRent: modification.minimumMonthlyRent,
          percentageRent: modification.percentageRent,
          decemberFactor: modification.decemberFactor,
        }),
      },
    })

    return NextResponse.json(modification, { status: 201 })
  } catch (error) {
    console.error('Error creating modification:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { 
        error: 'Error al crear la modificación',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
