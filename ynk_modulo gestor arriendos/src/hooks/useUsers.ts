'use client'

import { useState, useEffect, useCallback } from 'react'
import { usersApi, User, CreateUserRequest, UpdateUserRequest, isSuccess, isError } from '@/lib/api/users'

export type { User }
import { UserRole } from '@/lib/utils/permissions'

export interface UseUsersState {
  users: User[]
  loading: boolean
  error: string | null
  creating: boolean
  updating: boolean
  deleting: boolean
}

export interface UseUsersActions {
  fetchUsers: () => Promise<void>
  createUser: (userData: CreateUserRequest) => Promise<User | null>
  updateUser: (id: string, userData: UpdateUserRequest) => Promise<User | null>
  deleteUser: (id: string) => Promise<boolean>
  clearError: () => void
}

export interface UseUsersReturn extends UseUsersState, UseUsersActions {}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Función para limpiar errores
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Función para obtener todos los usuarios
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await usersApi.getUsers()

      if (isSuccess(response)) {
        setUsers(response.data || [])
      } else if (isError(response)) {
        setError(response.error)
        console.error('Error fetching users:', response.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Función para crear un usuario
  const createUser = useCallback(async (userData: CreateUserRequest): Promise<User | null> => {
    setCreating(true)
    setError(null)

    try {
      const response = await usersApi.createUser(userData)

      if (isSuccess(response)) {
        const newUser = response.data!
        setUsers(prev => [...prev, newUser])
        return newUser
      } else if (isError(response)) {
        setError(response.error)
        console.error('Error creating user:', response.error)
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      console.error('Error creating user:', err)
      return null
    } finally {
      setCreating(false)
    }

    return null
  }, [])

  // Función para actualizar un usuario
  const updateUser = useCallback(async (id: string, userData: UpdateUserRequest): Promise<User | null> => {
    setUpdating(true)
    setError(null)

    try {
      const response = await usersApi.updateUser(id, userData)

      if (isSuccess(response)) {
        const updatedUser = response.data!
        setUsers(prev => prev.map(user =>
          user.id === id ? updatedUser : user
        ))
        return updatedUser
      } else if (isError(response)) {
        setError(response.error)
        console.error('Error updating user:', response.error)
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      console.error('Error updating user:', err)
      return null
    } finally {
      setUpdating(false)
    }

    return null
  }, [])

  // Función para eliminar un usuario
  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    setDeleting(true)
    setError(null)

    try {
      const response = await usersApi.deleteUser(id)

      if (isSuccess(response)) {
        setUsers(prev => prev.filter(user => user.id !== id))
        return true
      } else if (isError(response)) {
        setError(response.error)
        console.error('Error deleting user:', response.error)
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      console.error('Error deleting user:', err)
      return false
    } finally {
      setDeleting(false)
    }

    return false
  }, [])

  // Cargar usuarios al montar el componente
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return {
    // Estado
    users,
    loading,
    error,
    creating,
    updating,
    deleting,

    // Acciones
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    clearError,
  }
}
