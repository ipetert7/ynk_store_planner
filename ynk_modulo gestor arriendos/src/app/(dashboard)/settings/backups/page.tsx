'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import BackupManagement from '@/components/features/backup/BackupManagement'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function BackupsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') {
      // Esperar a que NextAuth termine de cargar
      return
    }

    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Cargando..." />
      </div>
    )
  }

  if (status === 'unauthenticated' || !session) {
    return null // Redireccionará en el useEffect
  }

  return <BackupManagement />
}
