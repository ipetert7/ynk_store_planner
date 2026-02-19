import { redirect } from 'next/navigation'
import { updateStore } from '@/actions/store.actions'
import StoreForm from '@/components/features/stores/StoreForm'
import { Card, CardContent } from '@/components/ui/Card'
import Link from 'next/link'
import { storeService } from '@/services/store.service'

// Since it's a server component we don't need 'use client'
// But we need to handle form submission via client wrapper or pass action to client form?
// StoreForm is a client component ('use client').
// We can pass the server action as a prop or usage in StoreForm?
// StoreForm expects `onSubmit: (data) => Promise<void>`.
// Converting server action to compatible function is easy if we wrap it in a client component or here?
// Actually, server actions can be passed as props to Client Components.
// But StoreForm expects `StoreFormData` as input. `updateStore` takes `id` and `formData`.

import EditStoreClient from './EditStoreClient'

export default async function EditStorePage({ params }: { params: { id: string } }) {
  const store = await storeService.getById(params.id, { applyModifications: false }) // Editing original data

  if (!store) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Tienda no encontrada
          </h2>
          <p className="text-gray-600 mb-6">
            La tienda que buscas no existe o ha sido eliminada.
          </p>
          <Link href="/" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-base font-medium text-white hover:bg-slate-800">
            Volver al inicio
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (store.status === 'TERMINATED') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Editar Tienda
          </h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md" role="alert">
              <p className="text-sm font-medium text-red-800">
                No se puede editar un contrato terminado.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Editar Tienda
        </h1>
        <p className="text-gray-600">
          Modifica la información del contrato de <strong>{store.storeName}</strong>
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <EditStoreClient store={store as any} />
        </CardContent>
      </Card>
    </div>
  )
}
