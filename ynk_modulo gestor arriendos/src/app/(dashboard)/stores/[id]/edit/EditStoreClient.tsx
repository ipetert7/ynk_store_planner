'use client'

import { updateStore } from '@/actions/store.actions'
import StoreForm from '@/components/features/stores/StoreForm'
import { Store, StoreFormData } from '@/types/store'

interface EditStoreClientProps {
    store: Store
}

export default function EditStoreClient({ store }: EditStoreClientProps) {
    const handleSubmit = async (data: StoreFormData) => {
        const result = await updateStore(store.id, data)

        if (!result.success) {
            throw new Error(result.error || 'Error al actualizar la tienda')
        }
    }

    return <StoreForm store={store} onSubmit={handleSubmit} />
}
