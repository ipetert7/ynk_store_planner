import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createBackup,
  BackupOperationInProgressError,
  BACKUP_OPERATION_IN_PROGRESS,
} from '@/lib/backup'
import { RestoreInProgressError, RESTORE_IN_PROGRESS } from '@/lib/prisma'

/**
 * POST: Crear backup manual
 * Requiere autenticación de usuario
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

    // Crear backup
    const backup = await createBackup()

    return NextResponse.json({
      success: true,
      message: 'Backup creado exitosamente',
      backup: {
        id: backup.id,
        filename: backup.filename,
        createdAt: backup.createdAt,
        size: backup.size,
        compressedSize: backup.compressedSize,
        checksum: backup.checksum,
        storeCount: backup.storeCount,
      },
    })
  } catch (error) {
    console.error('Error creando backup manual:', error)

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
        error: 'Error creando backup',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
