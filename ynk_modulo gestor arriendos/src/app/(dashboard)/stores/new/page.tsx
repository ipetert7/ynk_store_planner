'use client'

import { useRouter } from 'next/navigation'
import { createStore } from '@/actions/store.actions'
import StoreForm from '@/components/features/stores/StoreForm'
import { StoreFormData } from '@/types/store'
import { Card, CardContent } from '@/components/ui/Card'

export default function NewStorePage() {
  const router = useRouter()

  const handleSubmit = async (data: StoreFormData) => {
    const result = await createStore(data)

    if (!result.success) {
      throw new Error(result.error || 'Error al crear la tienda')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Nueva Tienda
        </h1>
        <p className="text-gray-600">
          Completa el formulario para registrar una nueva tienda y su contrato de arriendo
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <StoreForm onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  )
}

