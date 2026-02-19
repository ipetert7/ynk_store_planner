import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateUserSession } from '@/lib/utils/user'
import { AuditAction } from '@/types/store'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; modificationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = await validateUserSession(session)

    // Verificar que la modificación existe y pertenece a la tienda
    const modification = await prisma.temporaryModification.findFirst({
      where: {
        id: params.modificationId,
        storeId: params.id,
      },
    })

    if (!modification) {
      return NextResponse.json(
        { error: 'Modificación no encontrada' },
        { status: 404 }
      )
    }

    // Eliminar la modificación
    await prisma.temporaryModification.delete({
      where: { id: params.modificationId },
    })

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        storeId: params.id,
        action: AuditAction.DELETE_TEMPORARY_MODIFICATION,
        fieldChanged: 'temporary_modification',
        oldValue: JSON.stringify({
          startDate: modification.startDate.toISOString(),
          endDate: modification.endDate.toISOString(),
          minimumMonthlyRent: modification.minimumMonthlyRent,
          percentageRent: modification.percentageRent,
          decemberFactor: modification.decemberFactor,
        }),
        newValue: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting modification:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { 
        error: 'Error al eliminar la modificación',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

