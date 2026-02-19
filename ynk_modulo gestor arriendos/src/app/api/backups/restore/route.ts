import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  restoreBackup,
  BackupOperationInProgressError,
  BACKUP_OPERATION_IN_PROGRESS,
} from '@/lib/backup'
import { RestoreInProgressError, RESTORE_IN_PROGRESS } from '@/lib/prisma'

/**
 * POST: Restaurar backup desde un backup específico
 * Requiere autenticación de usuario y ID del backup
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener datos del request
    const body = await request.json()
    const { backupId } = body

    if (!backupId || typeof backupId !== 'string') {
      return NextResponse.json(
        { error: 'ID de backup requerido' },
        { status: 400 }
      )
    }

    // Restaurar backup
    const restoredBackup = await restoreBackup(backupId)

    return NextResponse.json({
      success: true,
      message: 'Backup restaurado exitosamente',
      backup: {
        id: restoredBackup.id,
        filename: restoredBackup.filename,
        createdAt: restoredBackup.createdAt,
        size: restoredBackup.size,
        checksum: restoredBackup.checksum,
      },
    })
  } catch (error) {
    console.error('Error restaurando backup:', error)

    if (error instanceof BackupOperationInProgressError) {
      return NextResponse.json(
        {
          success: false,
          error: BACKUP_OPERATION_IN_PROGRESS,
          details: `Hay una operación de ${error.operation} en progreso. Intente nuevamente.`,
        },
        { status: 503 }
      )
    }

    if (error instanceof RestoreInProgressError) {
      return NextResponse.json(
        {
          success: false,
          error: RESTORE_IN_PROGRESS,
          details: error.message,
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error restaurando backup',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
