import { useState, useEffect, useCallback } from 'react'
import { usersService, UserProfile, UpdateUserProfileData } from '@/lib/api/users'
import { useErrorHandler } from './useErrorHandler'

export interface UseUserProfileReturn {
  profile: UserProfile | null
  loading: boolean
  error: string | null
  updateProfile: (data: UpdateUserProfileData) => Promise<void>
  uploadImage: (file: File) => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Hook para obtener y gestionar el perfil del usuario
 */
export function useUserProfile(): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const { handleError } = useErrorHandler()

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await usersService.getProfile()
      setProfile(data)
    } catch (err) {
      const errorMessage = handleError(err)
      setError(errorMessage)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [handleError])

  const updateProfile = useCallback(
    async (data: UpdateUserProfileData) => {
      try {
        setError(null)
        const updatedProfile = await usersService.updateProfile(data)
        setProfile(updatedProfile)
      } catch (err) {
        const errorMessage = handleError(err)
        setError(errorMessage)
        throw err
      }
    },
    [handleError]
  )

  const uploadImage = useCallback(
    async (file: File) => {
      try {
        setError(null)
        const result = await usersService.uploadProfileImage(file)
        // Update profile with new image URL
        if (profile) {
          setProfile({
            ...profile,
            profileImage: result.url,
          })
        }
      } catch (err) {
        const errorMessage = handleError(err)
        setError(errorMessage)
        throw err
      }
    },
    [profile, handleError]
  )

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return {
    profile,
    loading,
    error,
    updateProfile,
    uploadImage,
    refetch: fetchProfile,
  }
}

