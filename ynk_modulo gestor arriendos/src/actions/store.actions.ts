'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { storeService } from '@/services/store.service'
import { validateUserSession } from '@/lib/utils/user'
import { requireRole, UserRole } from '@/lib/utils/permissions'
import { createStoreSchema } from '@/lib/validations/store'
import { revalidatePath } from 'next/cache'

export async function createStore(formData: any) {
    try {
        const session = await getServerSession(authOptions)
        const user = await validateUserSession(session)

        // Verify permissions
        requireRole(session, UserRole.GESTOR)

        // Validate data
        const validatedData = createStoreSchema.parse(formData)

        // Create store
        const newStore = await storeService.create(validatedData, user.id)

        // Revalidate paths
        revalidatePath('/')
        revalidatePath('/stores')

        return { success: true, data: newStore }
    } catch (error: any) {
        console.error('Error creating store:', error)

        // Return friendly error message
        let errorMessage = 'Error al crear la tienda'
        if (error instanceof Error) {
            errorMessage = error.message
        }
        // Handle Zod errors if necessary, though simpler to just catch generic message for now
        if (error.errors && error.errors[0]) {
            errorMessage = error.errors[0].message
        }

        return { success: false, error: errorMessage }
    }
}


export async function updateStore(id: string, formData: any) {
    try {
        const session = await getServerSession(authOptions)
        const user = await validateUserSession(session)

        // Verify permissions
        requireRole(session, UserRole.GESTOR)

        // Validate data (using createStoreSchema as base, but id is separate)
        // Note: createStoreSchema requires erpId, which is fine for update too. 
        // We might want a separate update schema if some fields are read-only, but usually we allow editing all.
        const validatedData = createStoreSchema.parse(formData)

        // Update store
        const updatedStore = await storeService.update(id, validatedData, user.id)

        // Revalidate paths
        revalidatePath('/')
        revalidatePath('/stores')
        revalidatePath(`/stores/${id}`)
        revalidatePath(`/stores/${id}/edit`)

        return { success: true, data: updatedStore }
    } catch (error: any) {
        console.error('Error updating store:', error)

        let errorMessage = 'Error al actualizar la tienda'
        if (error instanceof Error) {
            errorMessage = error.message
        }
        if (error.errors && error.errors[0]) {
            errorMessage = error.errors[0].message
        }

        return { success: false, error: errorMessage }
    }
}
