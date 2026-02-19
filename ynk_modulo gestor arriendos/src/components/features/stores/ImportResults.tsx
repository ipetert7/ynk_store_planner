'use client'

import Button from '@/components/ui/Button'

interface ProcessResult {
  success: number
  failed: number
  updated: number
  created: number
  skipped: number
  errors: Array<{ row: number; erpId?: string; error: string }>
}

interface ImportResultsProps {
  result: ProcessResult
  onClose: () => void
}

export default function ImportResults({ result, onClose }: ImportResultsProps) {
  const totalProcessed = result.success + result.failed
  const hasErrors = result.errors.length > 0

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Resumen de la Importación
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{result.created}</div>
            <div className="text-sm text-gray-600">Creadas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
            <div className="text-sm text-gray-600">Actualizadas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{result.skipped}</div>
            <div className="text-sm text-gray-600">Omitidas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{result.failed}</div>
            <div className="text-sm text-gray-600">Con Error</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total procesadas:</span>
            <span className="font-medium">{totalProcessed}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-600">Éxito:</span>
            <span className={`font-medium ${result.success === totalProcessed ? 'text-green-600' : 'text-yellow-600'}`}>
              {totalProcessed > 0 ? Math.round((result.success / totalProcessed) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Lista de errores */}
      {hasErrors && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <svg className="h-5 w-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0116 0zm-7.707-2.293a1 1 0 101.414 1.414L10 11.414l6.293 6.293a1 1 0 001.414-1.414L11.414 10l6.293-6.293a1 1 0 00-1.414-1.414L10 8.586 3.707 2.293a1 1 0 00-1.414 1.414L8.586 10l-6.293 6.293z" clipRule="evenodd" />
            </svg>
            Errores Encontrados ({result.errors.length})
          </h4>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {result.errors.map((error, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0116 0zm-7.707-2.293a1 1 0 101.414 1.414L10 11.414l6.293 6.293a1 1 0 001.414-1.414L11.414 10l6.293-6.293a1 1 0 00-1.414-1.414L10 8.586 3.707 2.293a1 1 0 00-1.414 1.414L8.586 10l-6.293 6.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-red-800">
                        Fila {error.row}
                      </span>
                      {error.erpId && (
                        <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                          ID: {error.erpId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-red-700 mt-1">
                      {error.error}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Botón para descargar errores como CSV */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const csvContent = [
                  ['Fila', 'ID ERP', 'Error'],
                  ...result.errors.map(err => [err.row.toString(), err.erpId || '', err.error])
                ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = `errores_importacion_${new Date().toISOString().split('T')[0]}.csv`
                link.click()
              }}
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar Errores (CSV)
            </Button>
          </div>
        </div>
      )}

      {/* Mensaje de éxito completo */}
      {!hasErrors && result.success > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0116 0zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                ¡Importación completada exitosamente!
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  Todas las tiendas fueron procesadas correctamente.
                  {result.created > 0 && ` Se crearon ${result.created} tienda${result.created !== 1 ? 's' : ''} nuevas.`}
                  {result.updated > 0 && ` Se actualizaron ${result.updated} tienda${result.updated !== 1 ? 's' : ''} existentes.`}
                  {result.skipped > 0 && ` Se omitieron ${result.skipped} tienda${result.skipped !== 1 ? 's' : ''}.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          Cerrar
        </Button>
        {hasErrors && (
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              // Aquí podríamos implementar lógica para reintentar con errores corregidos
              // Por ahora solo cerramos
              onClose()
            }}
          >
            Entendido
          </Button>
        )}
      </div>
    </div>
  )
}
