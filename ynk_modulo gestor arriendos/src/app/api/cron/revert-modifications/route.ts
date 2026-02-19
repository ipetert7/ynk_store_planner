import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { AuditAction } from '@/types/store'

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
 * Normalizar fecha (solo año-mes-día, sin hora)
 */
function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

async function getSystemUserId(): Promise<string> {
  const email = process.env.SYSTEM_USER_EMAIL || 'system@ynk.local'
  const name = process.env.SYSTEM_USER_NAME || 'Sistema'

  let user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    const password = randomUUID()
    const hashedPassword = await bcrypt.hash(password, 10)
    user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    })
  }

  return user.id
}

/**
 * GET: Endpoint para cron job de Vercel
 * Elimina modificaciones temporales expiradas (endDate <= fecha actual)
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
    today.setHours(23, 59, 59, 999) // Incluir todo el día

    // Buscar modificaciones expiradas
    const expiredModifications = await prisma.temporaryModification.findMany({
      where: {
        endDate: {
          lte: today,
        },
      },
      include: {
        store: true,
      },
    })

    if (expiredModifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay modificaciones expiradas',
        deleted: 0,
      })
    }

    const systemUserId = await getSystemUserId()
    const auditLogs = expiredModifications.map((mod) => ({
      userId: systemUserId,
      storeId: mod.storeId,
      action: AuditAction.EXPIRE_TEMPORARY_MODIFICATION,
      fieldChanged: 'temporary_modification',
      oldValue: JSON.stringify({
        startDate: mod.startDate.toISOString(),
        endDate: mod.endDate.toISOString(),
        minimumMonthlyRent: mod.minimumMonthlyRent,
        percentageRent: mod.percentageRent,
        decemberFactor: mod.decemberFactor,
      }),
      newValue: null,
    }))

    const expiredIds = expiredModifications.map((mod) => mod.id)

    const [, deleteResult] = await prisma.$transaction([
      prisma.auditLog.createMany({
        data: auditLogs,
      }),
      prisma.temporaryModification.deleteMany({
        where: {
          id: { in: expiredIds },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: `Se eliminaron ${deleteResult.count} modificación(es) expirada(s)`,
      deleted: deleteResult.count,
      details: expiredModifications.map((mod) => ({
        id: mod.id,
        storeId: mod.storeId,
        storeName: mod.store.storeName,
        endDate: mod.endDate.toISOString().split('T')[0],
      })),
    })
  } catch (error) {
    console.error('Error in revert-modifications cron job:', error)
    return NextResponse.json(
      { 
        error: 'Error en cron job',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
