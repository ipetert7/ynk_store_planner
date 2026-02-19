import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { storeService } from '@/services/store.service'
import DashboardClient from '@/components/features/dashboard/DashboardClient'
import { parseStoreQueryParams, getUniqueOperators } from '@/lib/utils/store'
import Skeleton from '@/components/ui/Skeleton'
import { Card, CardContent } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/api/sso/consume?callbackUrl=/arriendos')
  }

  // Await searchParams as it is a promise in newer Next.js versions (though in 14 it might be object, handling as promise is safer or just use "await" if strict)
  // Actually in Next.js 14 it is just an object, but good to be careful. Let's assume object for now based on file inspection, but if build fails we adjust.
  // UPDATE: In recent Next.js versions searchParams is a plain object in page props type definition usually.
  // However, I'll treat it as resolved params for now.
  const resolvedSearchParams = await searchParams

  // Convert generic searchParams to URLSearchParams for the utility
  const urlSearchParams = new URLSearchParams()
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === 'string') {
      urlSearchParams.append(key, value)
    } else if (Array.isArray(value)) {
      value.forEach(v => urlSearchParams.append(key, v))
    }
  })

  const { filters, sort } = parseStoreQueryParams(urlSearchParams)

  // Fetch data in parallel
  const [initialStores, allStores] = await Promise.all([
    storeService.getAll({
      ...filters,
      surfaceMin: filters.surfaceMin ?? undefined,
      surfaceMax: filters.surfaceMax ?? undefined,
      vmmMin: filters.vmmMin ?? undefined,
      vmmMax: filters.vmmMax ?? undefined,
      dateFrom: filters.dateFrom ?? undefined,
      dateTo: filters.dateTo ?? undefined,
      sortBy: sort.field || undefined,
      sortOrder: sort.order,
    }),
    storeService.getAll({ status: 'ALL' }) // For KPIs
  ])

  // Get operators from all stores (or just filtered ones depending on requirement, usually all valid operators)
  const operators = getUniqueOperators(allStores)

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient
        initialStores={initialStores}
        allStores={allStores}
        operators={operators}
        initialFilters={filters}
        initialSort={sort}
        user={session.user as any}
      />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton height={36} width={200} />
        <Skeleton height={20} width={400} />
      </div>

      {/* Statistics Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Card key={i}>
            <CardContent className="py-4 px-6">
              <Skeleton height={16} width={80} className="mb-2" />
              <Skeleton height={32} width={60} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Skeleton */}
      <Card>
        <CardContent className="py-4 px-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <Skeleton height={44} className="flex-1 max-w-md" />
            <Skeleton height={44} width={224} />
            <Skeleton height={44} width={140} />
          </div>
        </CardContent>
      </Card>

      {/* Table Skeleton */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4"><Skeleton height={20} width={100} /></th>
                <th className="px-6 py-4"><Skeleton height={20} width={100} /></th>
                <th className="px-6 py-4"><Skeleton height={20} width={100} /></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-5"><Skeleton height={20} width={120} /></td>
                  <td className="px-6 py-5"><Skeleton height={20} width={100} /></td>
                  <td className="px-6 py-5"><Skeleton height={20} width={100} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
