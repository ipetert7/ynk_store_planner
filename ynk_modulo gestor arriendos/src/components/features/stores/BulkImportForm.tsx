'use client'

import { useState, useRef } from 'react'
import { StoreFormData } from '@/types/store'
import Button from '@/components/ui/Button'
import DuplicateStoresModal from './DuplicateStoresModal'
import { resolveApiPath } from '@/lib/api/paths'

interface ValidationResponse {
  validRows: Array<{ row: number; data: StoreFormData }>
  duplicates: Array<{
    row: number
    erpId: string
    excelData: StoreFormData
    existingStore: any
  }>
  errors: Array<{ row: number; error: string }>
  summary: {
    totalRows: number
    validRows: number
    duplicates: number
    errors: number
  }
}

interface ProcessResult {
  success: number
  failed: number
  updated: number
  created: number
  skipped: number
  errors: Array<{ row: number; erpId?: string; error: string }>
}

interface BulkImportFormProps {
  onImportComplete: (result: ProcessResult) => void
}

type Step = 'upload' | 'validating' | 'duplicates' | 'processing' | 'completed'

export default function BulkImportForm({ onImportComplete }: BulkImportFormProps) {
  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const validateEndpoint = resolveApiPath('/api/stores/bulk-import/validate')
  const processEndpoint = resolveApiPath('/api/stores/bulk-import/process')

  const getErrorMessageFromResponse = async (response: Response, fallback: string) => {
    try {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const errorData = await response.json()
        return errorData.error || errorData.message || fallback
      }

      const text = await response.text()
      return text ? `${fallback}: ${text.slice(0, 200)}` : fallback
    } catch {
      return fallback
    }
  }

  const mapFetchError = (err: unknown, endpoint: string, fallback: string) => {
    if (err instanceof TypeError) {
      return `${fallback}. Revisa conectividad/ruta API (${endpoint})`
    }
    if (err instanceof Error) {
      return err.message
    }
    return fallback
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validar tipo de archivo (alineado con backend: tolerante a MIME vacío/genérico)
      const allowedMimeTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
        ''
      ]
      const fileName = file.name.toLowerCase()
      const isValidExtension = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
      const isValidMimeType = allowedMimeTypes.includes(file.type)

      if (!isValidExtension && !isValidMimeType) {
        setError('Solo se permiten archivos Excel (.xlsx, .xls)')
        return
      }

      // Validar tamaño (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo no puede superar los 10MB')
        return
      }

      setSelectedFile(file)
      setError('')
    }
  }

  const handleValidate = async () => {
    if (!selectedFile) return

    setStep('validating')
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(validateEndpoint, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const message = await getErrorMessageFromResponse(response, 'Error al validar el archivo')
        throw new Error(message)
      }

      const result: ValidationResponse = await response.json()
      setValidationResult(result)

      // Si hay errores de validación, mostrarlos
      if (result.errors.length > 0) {
        setError(`Se encontraron ${result.errors.length} errores de validación. Revisa el archivo y vuelve a intentarlo.`)
        setStep('upload')
        return
      }

      // Si no hay duplicados, procesar directamente
      if (result.duplicates.length === 0) {
        await handleProcessImport(result.validRows, {})
      } else {
        // Mostrar modal de duplicados
        setStep('duplicates')
      }

    } catch (err: unknown) {
      setError(mapFetchError(err, validateEndpoint, 'Error al validar el archivo'))
      setStep('upload')
    }
  }

  const handleDuplicateDecisions = async (decisions: Record<string, 'update' | 'skip'>) => {
    if (!validationResult) return

    setStep('processing')

    try {
      await handleProcessImport(validationResult.validRows, decisions)
    } catch (err: any) {
      setError(err.message || 'Error al procesar la importación')
      setStep('duplicates')
    }
  }

  const handleProcessImport = async (
    rows: Array<{ row: number; data: StoreFormData }>,
    duplicateDecisions: Record<string, 'update' | 'skip'>
  ) => {
    try {
      const response = await fetch(processEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rows,
          duplicateDecisions,
        }),
      })

      if (!response.ok) {
        const message = await getErrorMessageFromResponse(response, 'Error al procesar la importación')
        throw new Error(message)
      }

      const result: ProcessResult = await response.json()
      setProcessResult(result)
      setStep('completed')
      onImportComplete(result)

    } catch (err: unknown) {
      throw new Error(mapFetchError(err, processEndpoint, 'Error al procesar la importación'))
    }
  }

  const handleReset = () => {
    setStep('upload')
    setSelectedFile(null)
    setValidationResult(null)
    setProcessResult(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* Instrucciones */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-blue-800">
              Formato del Archivo Excel
            </p>
            <div className="text-sm text-blue-700 mt-1">
              <p>El archivo debe contener las siguientes columnas obligatorias:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>ID (o ID ERP, ID Tienda)</li>
                <li>Nombre Tienda</li>
                <li>Banner</li>
                <li>Superficie Sala</li>
                <li>Superficie Total</li>
                <li>Operador Centro Comercial</li>
                <li>Fecha Inicio Contrato</li>
                <li>Fecha Término Contrato</li>
                <li>VMM</li>
                <li>Porcentaje Arriendo</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de archivo */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Seleccionar Archivo Excel
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                >
                  <span>Subir archivo</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="sr-only"
                  />
                </label>
                <p className="pl-1">o arrastrar y soltar</p>
              </div>
              <p className="text-xs text-gray-500">
                XLSX, XLS hasta 10MB
              </p>
            </div>
          </div>
        </div>

        {/* Archivo seleccionado */}
        {selectedFile && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0116 0zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Archivo seleccionado: {selectedFile.name}
                </p>
                <p className="text-sm text-green-700">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0116 0zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  Error
                </p>
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botón de importar */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="primary"
            onClick={handleValidate}
            disabled={!selectedFile || step === 'validating'}
            isLoading={step === 'validating'}
          >
            {step === 'validating' ? 'Validando...' : 'Importar Tiendas'}
          </Button>
        </div>
      </div>
    </div>
  )

  const renderValidatingStep = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-lg font-medium text-gray-900">Validando archivo...</p>
      <p className="mt-2 text-sm text-gray-600">
        Estamos revisando el formato y contenido de tu archivo Excel
      </p>
    </div>
  )

  const renderProcessingStep = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-lg font-medium text-gray-900">Procesando importación...</p>
      <p className="mt-2 text-sm text-gray-600">
        Estamos importando las tiendas a la base de datos
      </p>
    </div>
  )

  return (
    <div className="space-y-6">
      {step === 'upload' && renderUploadStep()}
      {step === 'validating' && renderValidatingStep()}
      {step === 'processing' && renderProcessingStep()}

      {/* Modal de duplicados */}
      {validationResult && step === 'duplicates' && (
        <DuplicateStoresModal
          duplicates={validationResult.duplicates}
          isOpen={true}
          onClose={() => setStep('upload')}
          onConfirm={handleDuplicateDecisions}
        />
      )}

      {/* Resultados */}
      {step === 'completed' && processResult && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0116 0zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Importación completada
                </p>
                <div className="text-sm text-green-700 mt-1">
                  <p>Tiendas creadas: {processResult.created}</p>
                  <p>Tiendas actualizadas: {processResult.updated}</p>
                  <p>Tiendas omitidas: {processResult.skipped}</p>
                  {processResult.failed > 0 && (
                    <p className="text-red-600">Errores: {processResult.failed}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleReset}
            >
              Importar Otro Archivo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
