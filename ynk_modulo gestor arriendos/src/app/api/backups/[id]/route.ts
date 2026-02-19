import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteBackup } from '@/lib/backup'

/**
 * DELETE: Eliminar backup específico
 * Requiere autenticación de usuario
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const backupId = params.id

    if (!backupId) {
      return NextResponse.json(
        { error: 'ID de backup requerido' },
        { status: 400 }
      )
    }

    // Eliminar backup
    await deleteBackup(backupId)

    return NextResponse.json({
      success: true,
      message: 'Backup eliminado exitosamente',
      deletedId: backupId,
    })
  } catch (error) {
    console.error('Error eliminando backup:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Error eliminando backup',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
