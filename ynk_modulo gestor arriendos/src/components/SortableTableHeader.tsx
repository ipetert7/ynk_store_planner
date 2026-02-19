'use client'

import { SortField, SortOrder } from '@/types/store'
import { cn } from '@/lib/utils'

interface SortableTableHeaderProps {
  field: SortField
  currentField: SortField | null
  currentOrder: SortOrder
  onSort: (field: SortField) => void
  children: React.ReactNode
  className?: string
}

export default function SortableTableHeader({
  field,
  currentField,
  currentOrder,
  onSort,
  children,
  className,
}: SortableTableHeaderProps) {
  const isActive = currentField === field

  const handleClick = () => {
    onSort(field)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <th
      className={cn(
        'px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider',
        'cursor-pointer select-none hover:bg-gray-100 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset',
        isActive && 'bg-gray-100',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Ordenar por ${children} ${isActive ? (currentOrder === 'asc' ? 'ascendente' : 'descendente') : ''}`}
      aria-sort={isActive ? (currentOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className="flex items-center gap-2">
        <span>{children}</span>
        <div className="flex flex-col">
          <svg
            className={cn(
              'w-3 h-3 transition-opacity',
              isActive && currentOrder === 'asc'
                ? 'text-indigo-600 opacity-100'
                : 'text-gray-400 opacity-30'
            )}
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          <svg
            className={cn(
              'w-3 h-3 transition-opacity -mt-1',
              isActive && currentOrder === 'desc'
                ? 'text-indigo-600 opacity-100'
                : 'text-gray-400 opacity-30'
            )}
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </th>
  )
}

