'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import BulkImportForm from '@/components/features/stores/BulkImportForm'
import ImportResults from '@/components/features/stores/ImportResults'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import Link from 'next/link'

interface ProcessResult {
  success: number
  failed: number
  updated: number
  created: number
  skipped: number
  errors: Array<{ row: number; erpId?: string; error: string }>
}

export default function ImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showResults, setShowResults] = useState(false)
  const [importResult, setImportResult] = useState<ProcessResult | null>(null)

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }
  }, [status, session, router])

  const handleImportComplete = (result: ProcessResult) => {
    setImportResult(result)
    setShowResults(true)
  }

  const handleBackToForm = () => {
    setShowResults(false)
    setImportResult(null)
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Cargando..." />
      </div>
    )
  }

  if (status === 'unauthenticated' || !session) {
    return null // Redireccionará en el useEffect
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center space-x-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver a Ajustes
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Importación Masiva de Tiendas
          </h1>
          <p className="text-gray-600 mt-2">
            Sube un archivo Excel para importar múltiples tiendas de forma automática.
            El sistema detectará tiendas duplicadas y te permitirá elegir cómo proceder.
          </p>
        </div>
      </div>

      {/* Contenido principal */}
      {!showResults ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <BulkImportForm onImportComplete={handleImportComplete} />
        </div>
      ) : (
        importResult && (
          <ImportResults
            result={importResult}
            onClose={handleBackToForm}
          />
        )
      )}

      {/* Información adicional */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Información Importante
        </h3>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900">Columnas Obligatorias</h4>
            <p className="text-sm text-gray-600 mt-1">
              Asegúrate de que tu archivo Excel contenga al menos estas columnas:
            </p>
            <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
              <li><strong>ID</strong> (o ID ERP, ID Tienda) - Identificador único</li>
              <li><strong>Nombre Tienda</strong> - Nombre de la tienda</li>
              <li><strong>Banner</strong> - Marca o banner de la tienda</li>
              <li><strong>Superficie Sala</strong> - Metros cuadrados de sala</li>
              <li><strong>Superficie Total</strong> - Metros cuadrados totales</li>
              <li><strong>Operador Centro Comercial</strong> - Nombre del operador</li>
              <li><strong>Fecha Inicio Contrato</strong> - Fecha de inicio (formato YYYY-MM-DD)</li>
              <li><strong>Fecha Término Contrato</strong> - Fecha de término (formato YYYY-MM-DD)</li>
              <li><strong>VMM</strong> - Valor mínimo mensual</li>
              <li><strong>Porcentaje Arriendo</strong> - Porcentaje de arriendo</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900">Columnas Opcionales</h4>
            <p className="text-sm text-gray-600 mt-1">
              Estas columnas son opcionales pero recomendadas:
            </p>
            <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
              <li>Factor Diciembre</li>
              <li>Gastos Comunes</li>
              <li>Fondo Promoción</li>
              <li>Días Notificación</li>
              <li>Renovación Automática (Sí/No)</li>
              <li>Tipo Aumento (ANNUAL/SPECIFIC_DATES)</li>
              <li>Porcentaje Aumento Anual</li>
              <li>Tipo Garantía (CASH/BANK_GUARANTEE)</li>
              <li>Monto Garantía</li>
              <li>Moneda Garantía (CLP/UF)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900">Consideraciones</h4>
            <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
              <li>El archivo debe estar en formato Excel (.xlsx o .xls)</li>
              <li>Tamaño máximo: 10MB</li>
              <li>Los IDs del ERP deben ser únicos en todo el archivo</li>
              <li>Si una tienda ya existe (mismo ID ERP), se te preguntará si actualizar u omitir</li>
              <li>Las fechas deben estar en formato YYYY-MM-DD (ej: 2024-01-15)</li>
              <li>Los valores numéricos pueden incluir decimales</li>
              <li>Los valores booleanos pueden ser Sí/No, True/False, 1/0</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
