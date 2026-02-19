import { NextRequest, NextResponse } from 'next/server'
import { createBackup } from '@/lib/backup'

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
 * GET: Endpoint para cron job de backup automático
 * Se ejecuta diariamente para crear backup de la base de datos
 */
export async function GET(request: NextRequest) {
  // Verificar autorización
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    )
  }

  // Verificar si los backups están habilitados
  if (process.env.BACKUP_ENABLED === 'false') {
    return NextResponse.json({
      success: true,
      message: 'Backups deshabilitados',
      skipped: true,
    })
  }

  try {
    // Crear backup
    const backupResult = await createBackup()

    return NextResponse.json({
      success: true,
      message: 'Backup creado exitosamente',
      backup: {
        id: backupResult.id,
        filename: backupResult.filename,
        createdAt: backupResult.createdAt,
        size: backupResult.size,
        compressedSize: backupResult.compressedSize,
        checksum: backupResult.checksum,
      },
    })
  } catch (error) {
    console.error('Error in backup cron job:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Error en cron job de backup',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
