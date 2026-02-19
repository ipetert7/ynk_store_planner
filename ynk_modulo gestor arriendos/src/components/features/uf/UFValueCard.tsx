'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { useUF } from '@/hooks/useUF'
import UFHistoryModal from './UFHistoryModal'
import Skeleton from '@/components/ui/Skeleton'
import { formatNumber } from '@/lib/utils/format'

export default function UFValueCard() {
  const [mounted, setMounted] = useState(false)
  const { uf, loading, error } = useUF({ autoFetch: mounted })
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const formatValue = (value: number) => {
    return formatNumber(value)
  }

  if (!mounted) {
    return (
      <Card hover padding="none" className="cursor-pointer transition-all hover:shadow-lg">
        <CardContent className="py-3 px-6">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-medium text-gray-600 truncate">UF Hoy</p>
            <svg
              className="w-5 h-5 text-indigo-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="mt-1.5">
            <Skeleton height={28} width={120} />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50"
      >
        <Card hover padding="none" className="cursor-pointer transition-all hover:shadow-lg">
          <CardContent className="py-3 px-6">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm font-medium text-gray-600 truncate">UF Hoy</p>
              <svg
                className="w-5 h-5 text-indigo-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            {loading ? (
              <div className="mt-1.5">
                <Skeleton height={28} width={120} />
              </div>
            ) : error ? (
              <div className="mt-1.5">
                <p className="text-sm text-red-600">Error</p>
                <p className="text-xs text-red-500 mt-1 truncate">{error}</p>
              </div>
            ) : uf ? (
              <p className="mt-1.5 text-lg font-semibold text-indigo-600 whitespace-nowrap">
                CLP${formatValue(uf.value)}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-gray-500">No disponible</p>
            )}
          </CardContent>
        </Card>
      </button>

      <UFHistoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
