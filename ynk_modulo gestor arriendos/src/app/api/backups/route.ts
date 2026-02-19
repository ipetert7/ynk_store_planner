import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listBackups } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET: Listar todos los backups disponibles
 * Requiere autenticación de usuario
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener lista de backups
    const backupList = await listBackups()

    return NextResponse.json({
      success: true,
      backups: backupList.backups.map(backup => ({
        id: backup.id,
        filename: backup.filename,
        createdAt: backup.createdAt,
        size: backup.size,
        compressedSize: backup.compressedSize,
        checksum: backup.checksum,
        storeCount: backup.storeCount,
      })),
      summary: {
        totalBackups: backupList.backups.length,
        totalSize: backupList.totalSize,
        lastBackup: backupList.lastBackup,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error) {
    console.error('Error listando backups:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Error obteniendo lista de backups',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    )
  }
}
