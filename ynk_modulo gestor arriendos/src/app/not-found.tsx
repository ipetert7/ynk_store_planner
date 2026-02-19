'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card>
        <CardContent className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Página no encontrada
          </h2>
          <p className="text-gray-600 mb-6">
            La página que buscas no existe o ha sido movida.
          </p>
          <Button
            onClick={() => router.push('/')}
            variant="primary"
          >
            Volver al inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

