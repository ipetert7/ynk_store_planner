'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import { ufService, UFHistoryResponse } from '@/lib/api/uf'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { formatNumber } from '@/lib/utils/format'

interface UFHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

type Period = '1M' | '2M' | '3M' | '6M' | '1A'

const PERIOD_DAYS: Record<Period, number> = {
  '1M': 30,
  '2M': 60,
  '3M': 90,
  '6M': 180,
  '1A': 365,
}

const PERIOD_LABELS: Record<Period, string> = {
  '1M': '1 Mes',
  '2M': '2 Meses',
  '3M': '3 Meses',
  '6M': '6 Meses',
  '1A': '1 Año',
}

export default function UFHistoryModal({
  isOpen,
  onClose,
}: UFHistoryModalProps) {
  const [history, setHistory] = useState<UFHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1A')
  const [preloading, setPreloading] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState<{
    loaded: number
    total: number
    current: number
  } | null>(null)
  const [preloadResult, setPreloadResult] = useState<{
    loaded: number
    remaining: number
    total: number
  } | null>(null)
  const [showResyncDialog, setShowResyncDialog] = useState(false)
  const [resyncing, setResyncing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchHistory()
    } else {
      setHistory(null)
      setError(null)
      setPreloadResult(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedPeriod])

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)
    setHistory(null) // Limpiar datos anteriores antes de cargar nuevos
    try {
      const days = PERIOD_DAYS[selectedPeriod]
      const data = await ufService.getHistory(days)
      setHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar historial')
      console.error('Error fetching UF history:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePreloadHistory = async () => {
    setPreloading(true)
    setPreloadResult(null)
    setPreloadProgress(null)
    setError(null)

    try {
      const days = PERIOD_DAYS[selectedPeriod]

      // Primero obtener el total de valores faltantes
      const initialHistory = await ufService.getHistory(days)
      const totalDays = PERIOD_DAYS[selectedPeriod]
      const missingCount = totalDays - (initialHistory.count || 0)

      if (missingCount <= 0) {
        setShowResyncDialog(true)
        setPreloading(false)
        return
      }

      // Si faltan pocos valores, asumir que la API externa no los tiene disponibles
      // y ofrecer opción de resincronizar los valores existentes
      if (missingCount <= 10) {
        setShowResyncDialog(true)
        setPreloading(false)
        return
      }

      // Cargar TODOS los valores faltantes de una sola vez, sin importar cuántos sean
      setPreloadProgress({
        loaded: 0,
        total: missingCount,
        current: 0,
      })

      const result = await ufService.preloadHistory(days)

      setPreloadProgress({
        loaded: result.loaded,
        total: result.total,
        current: result.loaded,
      })

      setPreloadResult({
        loaded: result.loaded,
        remaining: result.remaining,
        total: result.total,
      })

      // Recargar el historial después de precargar
      await fetchHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al precargar historial')
      console.error('Error preloading UF history:', err)
      setPreloadProgress(null)
    } finally {
      setPreloading(false)
    }
  }

  const handleResyncHistory = async () => {
    setResyncing(true)
    setShowResyncDialog(false)
    setPreloadResult(null)
    setPreloadProgress(null)
    setError(null)

    try {
      const days = PERIOD_DAYS[selectedPeriod]

      // Mostrar progreso de resincronización
      setPreloadProgress({
        loaded: 0,
        total: days,
        current: 0,
      })

      // Ejecutar resincronización completa (borra todo y recarga todo)
      const result = await ufService.resyncHistory(days)

      // Actualizar progreso final
      setPreloadProgress({
        loaded: result.loaded,
        total: result.loaded + result.errors,
        current: result.loaded,
      })

      setPreloadResult({
        loaded: result.loaded,
        remaining: 0, // Resincronización completa
        total: result.loaded + result.errors,
      })

      // Recargar el historial después de resincronizar
      await fetchHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al resincronizar historial')
      console.error('Error resyncing UF history:', err)
      setPreloadProgress(null)
    } finally {
      setResyncing(false)
    }
  }

  // Formatear datos para el gráfico
  const chartData = history?.data
    .map((item) => ({
      date: format(new Date(item.date), 'dd/MM/yyyy'),
      value: item.value,
      fullDate: item.date,
      timestamp: new Date(item.date).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp) || []

  // Calcular dominio del eje Y con +/- 5% de los valores min/max
  const getYAxisDomain = () => {
    if (chartData.length === 0) {
      return undefined
    }
    const values = chartData.map((d) => d.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue
    const padding = range * 0.05 // 5% de padding
    
    return [minValue - padding, maxValue + padding]
  }

  const yAxisDomain = getYAxisDomain()

  // Calcular intervalo del eje X según la cantidad de datos
  const getXAxisInterval = () => {
    const dataLength = chartData.length
    if (dataLength <= 30) {
      return 0 // Mostrar todas las etiquetas para períodos cortos
    } else if (dataLength <= 90) {
      return Math.floor(dataLength / 8) // ~8 etiquetas para 1-3 meses
    } else if (dataLength <= 180) {
      return Math.floor(dataLength / 10) // ~10 etiquetas para 6 meses
    } else {
      return Math.floor(dataLength / 12) // ~12 etiquetas para 1 año
    }
  }

  const xAxisInterval = getXAxisInterval()

  // Formatear valor para tooltip
  const formatValue = (value: number) => {
    return `CLP$${formatNumber(value)}`
  }

  const getTitle = () => {
    return `Historial UF - ${PERIOD_LABELS[selectedPeriod]}`
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      size="xl"
    >
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" text="Cargando historial de UF..." />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-2">
            Error al cargar historial
          </p>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchHistory}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No hay datos disponibles</p>
        </div>
      ) : chartData.length < 2 ? (
        <div className="space-y-4">
          {/* Selector de período y botón de actualizar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">Período:</span>
              {(['1M', '2M', '3M', '6M', '1A'] as Period[]).map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className="min-w-[60px]"
                  disabled={preloading}
                >
                  {period}
                </Button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreloadHistory}
              disabled={preloading || loading || resyncing}
              className="flex items-center gap-2"
            >
              {preloading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Cargando...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Actualizar
                </>
              )}
            </Button>
          </div>

          {/* Indicador de progreso de precarga */}
          {preloading && preloadProgress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-900">
                  Cargando valores históricos...
                </p>
                <p className="text-sm text-blue-700">
                  {preloadProgress.current} / {preloadProgress.total}
                </p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${preloadProgress.total > 0 ? (preloadProgress.current / preloadProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-2">
                {preloadProgress.total > 0
                  ? `Progreso: ${Math.round((preloadProgress.current / preloadProgress.total) * 100)}%`
                  : 'Calculando...'}
              </p>
            </div>
          )}

          {/* Mensaje de resultado de precarga */}
          {!preloading && preloadResult && (
            <div className={`rounded-lg p-4 mb-4 ${
              preloadResult.loaded > 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <p className="text-sm font-medium text-gray-900">
                {preloadResult.loaded > 0
                  ? `✓ Se cargaron ${preloadResult.loaded} ${preloadResult.loaded === 1 ? 'valor' : 'valores'} nuevos`
                  : 'No se encontraron valores nuevos para cargar'
                }
              </p>
              {preloadResult.remaining > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  Aún faltan {preloadResult.remaining} {preloadResult.remaining === 1 ? 'valor' : 'valores'}.
                  Puedes presionar "Actualizar" nuevamente para cargar más.
                </p>
              )}
            </div>
          )}

          {/* Diálogo de resincronización */}
          {showResyncDialog && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Todos los valores ya están sincronizados
                  </p>
                  <p className="text-sm text-blue-700 mb-4">
                    No se encontraron valores faltantes para el período seleccionado. ¿Quieres borrar todos los valores existentes y volver a sincronizar desde cero?
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowResyncDialog(false)}
                      disabled={resyncing}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleResyncHistory}
                      disabled={resyncing}
                      className="flex items-center gap-2"
                    >
                      {resyncing ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Resincronizando...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Sí, resincronizar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mensaje informativo cuando hay muy pocos datos */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Datos limitados disponibles
                </p>
                <p className="text-sm text-blue-700">
                  Solo hay {chartData.length} {chartData.length === 1 ? 'día' : 'días'} de datos almacenados para este período. 
                  Presiona el botón "Actualizar" arriba para cargar más valores históricos desde la API externa.
                </p>
              </div>
            </div>
          </div>

          {/* Información resumida */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Valor disponible</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatValue(chartData[0]?.value || 0)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Fecha</p>
              <p className="text-lg font-semibold text-gray-900">
                {chartData[0]?.date || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Estado</p>
              <p className="text-lg font-semibold text-indigo-600">
                Único valor
              </p>
            </div>
          </div>

          {/* Información adicional */}
          <div className="text-sm text-gray-600 text-center pt-4 border-t border-gray-200">
            <p>
              Mostrando {history?.count || 0} {history?.count === 1 ? 'día' : 'días'} de los últimos {PERIOD_DAYS[selectedPeriod]} días
            </p>
            <p className="mt-1">
              Los valores se actualizan diariamente desde el SII. El cron job precarga valores históricos gradualmente.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selector de período y botón de actualizar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">Período:</span>
              {(['1M', '2M', '3M', '6M', '1A'] as Period[]).map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className="min-w-[60px]"
                  disabled={preloading}
                >
                  {period}
                </Button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreloadHistory}
              disabled={preloading || loading || resyncing}
              className="flex items-center gap-2"
            >
              {preloading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Cargando...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Actualizar
                </>
              )}
            </Button>
          </div>

          {/* Indicador de progreso de precarga */}
          {preloading && preloadProgress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-900">
                  Cargando valores históricos...
                </p>
                <p className="text-sm text-blue-700">
                  {preloadProgress.current} / {preloadProgress.total}
                </p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${preloadProgress.total > 0 ? (preloadProgress.current / preloadProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-blue-600 mt-2">
                {preloadProgress.total > 0
                  ? `Progreso: ${Math.round((preloadProgress.current / preloadProgress.total) * 100)}%`
                  : 'Calculando...'}
              </p>
            </div>
          )}

          {/* Mensaje de resultado de precarga */}
          {!preloading && preloadResult && (
            <div className={`rounded-lg p-4 mb-4 ${
              preloadResult.loaded > 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <p className="text-sm font-medium text-gray-900">
                {preloadResult.loaded > 0
                  ? `✓ Se cargaron ${preloadResult.loaded} ${preloadResult.loaded === 1 ? 'valor' : 'valores'} nuevos`
                  : 'No se encontraron valores nuevos para cargar'
                }
              </p>
              {preloadResult.remaining > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  Aún faltan {preloadResult.remaining} {preloadResult.remaining === 1 ? 'valor' : 'valores'}.
                  Puedes presionar "Actualizar" nuevamente para cargar más.
                </p>
              )}
            </div>
          )}

          {/* Diálogo de resincronización */}
          {showResyncDialog && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Todos los valores ya están sincronizados
                  </p>
                  <p className="text-sm text-blue-700 mb-4">
                    No se encontraron valores faltantes para el período seleccionado. ¿Quieres borrar todos los valores existentes y volver a sincronizar desde cero?
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowResyncDialog(false)}
                      disabled={resyncing}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleResyncHistory}
                      disabled={resyncing}
                      className="flex items-center gap-2"
                    >
                      {resyncing ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Resincronizando...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Sí, resincronizar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Información resumida */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Valor más bajo</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatValue(Math.min(...chartData.map((d) => d.value)))}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Valor más alto</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatValue(Math.max(...chartData.map((d) => d.value)))}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Valor actual</p>
              <p className="text-lg font-semibold text-indigo-600">
                {formatValue(chartData[chartData.length - 1]?.value || 0)}
              </p>
            </div>
          </div>

          {/* Gráfico */}
          <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                key={selectedPeriod}
                data={chartData} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={xAxisInterval}
                  minTickGap={20}
                />
                <YAxis
                  domain={yAxisDomain}
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `$${formatNumber(value)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                  }}
                  formatter={(value: number | undefined) => value !== undefined ? [formatValue(value), 'UF'] : ['', '']}
                  labelFormatter={(label) => `Fecha: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={chartData.length <= 30 ? { r: 4, fill: '#4f46e5' } : false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Información adicional */}
          <div className="text-sm text-gray-600 text-center pt-4 border-t border-gray-200">
            <p>
              Mostrando {history?.count || 0} {history?.count === 1 ? 'día' : 'días'} de los últimos {PERIOD_DAYS[selectedPeriod]} días
            </p>
            <p className="mt-1">
              Los valores se actualizan diariamente desde el SII
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
