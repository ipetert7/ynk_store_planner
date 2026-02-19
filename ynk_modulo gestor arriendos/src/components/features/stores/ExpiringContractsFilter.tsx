'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface ExpiringContractsFilterProps {
  onFilterChange: (filter: {
    months?: number
    notificationDays?: number
    search?: string
  }) => void
}

export default function ExpiringContractsFilter({
  onFilterChange,
}: ExpiringContractsFilterProps) {
  const [filterType, setFilterType] = useState<'months' | 'notification'>('months')
  const [months, setMonths] = useState<number>(12)
  const [notificationDays, setNotificationDays] = useState<number>(30)
  const [search, setSearch] = useState('')

  const handleFilterTypeChange = (type: 'months' | 'notification') => {
    setFilterType(type)
    if (type === 'months') {
      onFilterChange({ months, search: search || undefined })
    } else {
      onFilterChange({ notificationDays, search: search || undefined })
    }
  }

  const handleMonthsChange = (value: number) => {
    setMonths(value)
    onFilterChange({ months: value, search: search || undefined })
  }

  const handleNotificationDaysChange = (value: number) => {
    setNotificationDays(value)
    onFilterChange({ notificationDays: value, search: search || undefined })
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (filterType === 'months') {
      onFilterChange({ months, search: value || undefined })
    } else {
      onFilterChange({ notificationDays, search: value || undefined })
    }
  }

  return (
    <Card>
      <CardContent className="py-4 px-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Filter Type Toggle */}
          <div className="flex gap-2 w-full lg:w-auto">
            <Button
              variant={filterType === 'months' ? 'primary' : 'secondary'}
              onClick={() => handleFilterTypeChange('months')}
              size="md"
              className="flex-1 lg:flex-none"
            >
              Por Meses
            </Button>
            <Button
              variant={filterType === 'notification' ? 'primary' : 'secondary'}
              onClick={() => handleFilterTypeChange('notification')}
              size="md"
              className="flex-1 lg:flex-none"
            >
              Por Notificación
            </Button>
          </div>

          {/* Filter Options */}
          {filterType === 'months' ? (
            <div className="flex flex-wrap gap-2 flex-1">
              {[3, 6, 12].map((m) => (
                <Button
                  key={m}
                  variant={months === m ? 'primary' : 'secondary'}
                  onClick={() => handleMonthsChange(m)}
                  size="md"
                >
                  {m} meses
                </Button>
              ))}
            </div>
          ) : (
            <div className="w-full lg:w-64">
              <Input
                type="number"
                value={notificationDays.toString()}
                onChange={(e) => handleNotificationDaysChange(parseInt(e.target.value) || 0)}
                placeholder="Días hasta notificación"
                leftIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </div>
          )}

          {/* Search */}
          <div className="w-full lg:w-64 lg:ml-auto">
            <Input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por nombre, banner..."
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

