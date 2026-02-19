import { storeService } from '@/services/store.service'
import { StoreStatus } from '@/types/store'
import ExpiringContractsClient from './ExpiringContractsClient'

export const dynamic = 'force-dynamic'

export default async function ExpiringContractsPage() {
  // Fetch all ACTIVE stores.
  // We can filter for expiring ones if we want to reduce payload, 
  // but "expiring" logic here includes "already expired" AND "expiring soon (12mo)".
  // storeService.getAll support expiringMonths but that might be strict?
  // Let's get all ACTIVE and filter in client (or passed to client) as before, 
  // OR we can improve storeService to return efficiently.
  // For now, fetching ACTIVE stores and letting Client Component filter/sort is safe migration.

  const stores = await storeService.getAll({
    status: StoreStatus.ACTIVE,
    // We could add `expiringMonths: 12` if we want to limit somewhat, 
    // but the requirement "Include expired" might mean getAll needs `status: ACTIVE` and then check dates.
    // Also `getAll` implementation of `expiringMonths` uses `lte` date. 
    // If `expiringMonths` is passed, it returns stores ending before Today + X months.
    // This INCLUDES expired stores (ending before Today).
    // So passing `expiringMonths: 12` is a good optimization!
    expiringMonths: 12
  })

  // Convert dates to string/serialized for Client Component
  // Actually, Server Components pass Serializable data. Dates are not serializable by default in Next.js props?
  // Next.js warns about Date objects passed to Client Components.
  // We should convert them.

  const serializedStores = stores.map((store: any) => ({
    ...store,
    contractStartDate: store.contractStartDate.toISOString(), // or new Date() if client converts back
    contractEndDate: store.contractEndDate.toISOString(),
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
    rentIncreaseDates: store.rentIncreaseDates.map((d: any) => ({
      ...d,
      increaseDate: d.increaseDate.toISOString()
    }))
    // ... activeModification dates too if they exist
  }))

  return <ExpiringContractsClient initialStores={serializedStores as any} />
}
