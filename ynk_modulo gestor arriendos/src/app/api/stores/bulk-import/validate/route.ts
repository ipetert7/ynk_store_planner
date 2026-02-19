import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateUserSession } from '@/lib/utils/user'
import { requireRole, UserRole } from '@/lib/utils/permissions'
import * as XLSX from 'xlsx'
import { validateExcelRows } from '@/lib/utils/excel'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🧭 bulk-import/validate request', {
        url: request.url,
        contentType: request.headers.get('content-type'),
      })
    }

    const session = await getServerSession(authOptions)
    
    // Verificar autenticación
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado - sesión requerida' },
        { status: 401 }
      )
    }

    // Verificar permisos - solo GESTOR o ADMINISTRADOR pueden importar
    try {
      requireRole(session, UserRole.GESTOR)
    } catch (permissionError: any) {
      return NextResponse.json(
        { error: permissionError.message || 'No autorizado' },
        { status: 403 }
      )
    }

    // Validar sesión de usuario
    let user
    try {
      user = await validateUserSession(session)
    } catch (userError: any) {
      console.error('❌ Error validando sesión de usuario:', {
        error: userError.message,
        sessionUserId: session?.user?.id,
        sessionEmail: session?.user?.email
      })
      
      // Si el usuario no se encuentra, sugerir cerrar sesión
      if (userError.message.includes('no encontrado')) {
        return NextResponse.json(
          { 
            error: 'Tu sesión está desactualizada. Por favor, cierra sesión y vuelve a iniciar sesión.',
            details: 'El usuario en tu sesión no existe en la base de datos. Esto puede ocurrir después de resetear la base de datos.'
          },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { error: userError.message || 'Error validando sesión de usuario' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validar tipo MIME (ser más tolerante con tipos MIME)
    const fileName = file.name.toLowerCase()
    const isValidExtension = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.type) || 
                           file.type === '' || // Algunos navegadores no envían tipo MIME
                           file.type === 'application/octet-stream' // Tipo genérico

    if (!isValidMimeType && !isValidExtension) {
      console.warn(`Tipo MIME no reconocido: ${file.type}, nombre archivo: ${file.name}`)
      return NextResponse.json(
        {
          error: 'Tipo de archivo no permitido. Solo se permiten archivos Excel (.xlsx, .xls)',
          details: `Tipo recibido: ${file.type || 'desconocido'}`
        },
        { status: 400 }
      )
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. El tamaño máximo es 10MB' },
        { status: 400 }
      )
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('📎 bulk-import file metadata', {
        name: file.name,
        size: file.size,
        type: file.type,
      })
    }

    // Leer archivo Excel
    console.log(`📂 Procesando archivo: ${file.name}, tamaño: ${file.size} bytes, tipo: ${file.type}`)
    
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`📊 Leyendo Excel...`)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Convertir a JSON
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet)
    const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]

    console.log(`✅ Excel leído: ${rows.length} filas, ${headers.length} columnas`)
    console.log(`📋 Headers: ${headers.slice(0, 5).join(', ')}...`)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'El archivo Excel no contiene datos' },
        { status: 400 }
      )
    }

    // Obtener IDs de ERP existentes en la base de datos
    const existingStores = await prisma.store.findMany({
      select: { erpId: true, id: true, storeName: true, banner: true }
    })

    const existingErpIds = new Set(existingStores.map(store => store.erpId).filter((erpId): erpId is string => erpId !== null))

    // Validar filas del Excel
    console.log(`🔍 Iniciando validación de ${rows.length} filas...`)
    let validationResult
    try {
      validationResult = validateExcelRows(rows, headers, existingErpIds)
      console.log(`✅ Validación completada: ${validationResult.validRows.length} válidas, ${validationResult.duplicates.length} duplicados, ${validationResult.errors.length} errores`)
    } catch (validationError: any) {
      console.error('❌ Error durante validación:', validationError)
      console.error('Stack:', validationError.stack)
      throw validationError
    }

    // Para los duplicados, obtener la información completa de las tiendas existentes
    const existingStoresMap = new Map(
      existingStores
        .filter(store => store.erpId !== null)
        .map(store => [store.erpId!, store])
    )

    validationResult.duplicates.forEach(duplicate => {
      duplicate.existingStore = existingStoresMap.get(duplicate.erpId) || null
    })

    return NextResponse.json({
      validRows: validationResult.validRows,
      duplicates: validationResult.duplicates,
      errors: validationResult.errors,
      summary: {
        totalRows: rows.length,
        validRows: validationResult.validRows.length,
        duplicates: validationResult.duplicates.length,
        errors: validationResult.errors.length
      }
    })

  } catch (error) {
    console.error('❌ Error validating Excel file:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    const errorStack = error instanceof Error ? error.stack : undefined

    // Log detallado siempre (no solo en desarrollo)
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error,
      name: error instanceof Error ? error.name : undefined
    })

    // Determinar si es un error de validación o un error del servidor
    const isValidationError = errorMessage.includes('Fecha') || 
                             errorMessage.includes('erpId') ||
                             errorMessage.includes('columna') ||
                             errorMessage.includes('requerido')

    return NextResponse.json(
      {
        error: isValidationError 
          ? `Error de validación: ${errorMessage}`
          : 'Error al validar el archivo Excel',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: isValidationError ? 400 : 500 }
    )
  }
}
