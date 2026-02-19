'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import UserProfileForm from '@/components/features/users/UserProfileForm'
import { Card, CardContent } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { resolveApiPath } from '@/lib/api/paths'

interface UserProfile {
  id: string
  email: string
  name: string
  profileImage?: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    let didRedirect = false
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(resolveApiPath('/api/user/profile'))
      if (response.ok) {
        const data = await response.json()
        setUser(data)
        return
      }
      if (response.status === 401) {
        didRedirect = true
        router.push('/login')
      } else {
        // Si hay un error, intentar obtener el mensaje
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }))
        console.error('Error fetching profile:', response.status, errorData)
        setError(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }
    } catch (error: unknown) {
      console.error('Error fetching profile:', error)
      const message = error instanceof Error ? error.message : 'Error al cargar el perfil'
      setError(message)
    } finally {
      if (!didRedirect) {
        setLoading(false)
      }
    }
  }, [router])

  useEffect(() => {
    if (status === 'loading') {
      // Esperar a que NextAuth termine de cargar
      return
    }
    
    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }

    if (status === 'authenticated' && session) {
      fetchProfile()
    }
  }, [status, session, fetchProfile])

  const handleSubmit = async (data: {
    name: string
    password?: string
    confirmPassword?: string
    profileImage?: File | null
  }) => {
    // Primero subir la imagen si hay una nueva
    let profileImagePath = user?.profileImage || null
    if (data.profileImage) {
      const formData = new FormData()
      formData.append('file', data.profileImage)

      const uploadResponse = await fetch(resolveApiPath('/api/user/profile/upload'), {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Error al subir la foto de perfil')
      }

      const uploadData = await uploadResponse.json()
      profileImagePath = uploadData.profileImage
    }

    // Luego actualizar el perfil
    const updateResponse = await fetch(resolveApiPath('/api/user/profile'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        password: data.password,
        confirmPassword: data.confirmPassword,
      }),
    })

    if (!updateResponse.ok) {
      const error = await updateResponse.json()
      throw new Error(error.error || 'Error al actualizar el perfil')
    }

    const updatedUser = await updateResponse.json()

    // Actualizar estado local
    setUser({
      ...updatedUser,
      profileImage: profileImagePath,
    })

    // Actualizar sesión de NextAuth - esto disparará el callback jwt con trigger='update'
    // que obtendrá los datos más recientes de la base de datos
    await updateSession()

    // Mostrar mensaje de éxito (podrías usar un toast aquí)
    alert('Perfil actualizado correctamente')
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Cargando perfil..." />
      </div>
    )
  }

  if (!user && !loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error al cargar el perfil
          </h2>
          <p className="text-gray-600 mb-2">
            No se pudo cargar la información del perfil.
          </p>
          {error && (
            <p className="text-sm text-red-600 mb-4">
              {error}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fetchProfile()}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700"
            >
              Reintentar
            </button>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Volver al inicio
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Editar Perfil
        </h1>
        <p className="text-gray-600">
          Actualiza tu información personal y foto de perfil
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <UserProfileForm initialData={user} onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  )
}
