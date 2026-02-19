import { UserRole } from '@/lib/utils/permissions'
import { resolveApiPath } from '@/lib/api/paths'

// Tipos para las respuestas de la API
export interface User {
  id: string
  email: string
  name: string | null
  role: string
  profileImage: string | null
  createdAt: string
}

export interface UserProfile {
  id: string
  email: string
  name: string | null
  profileImage: string | null
}

export interface UpdateUserProfileData {
  name?: string
  password?: string
  confirmPassword?: string
}

export interface CreateUserRequest {
  email: string
  password: string
  name?: string
  role: UserRole
}

export interface UpdateUserRequest {
  email?: string
  password?: string
  name?: string
  role?: UserRole
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

// Cliente API base
class ApiClient {
  private baseUrl = resolveApiPath('/api')

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          error: data.error || `Error ${response.status}: ${response.statusText}`,
        }
      }

      return { data }
    } catch (error) {
      console.error('API request failed:', error)
      return {
        error: error instanceof Error ? error.message : 'Error desconocido',
      }
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

const apiClient = new ApiClient()

// Funciones específicas para usuarios
export const usersApi = {
  // Obtener todos los usuarios
  async getUsers(): Promise<ApiResponse<User[]>> {
    return apiClient.get<User[]>('/users')
  },

  // Obtener un usuario específico
  async getUser(id: string): Promise<ApiResponse<User>> {
    return apiClient.get<User>(`/users/${id}`)
  },

  // Crear un nuevo usuario
  async createUser(userData: CreateUserRequest): Promise<ApiResponse<User>> {
    return apiClient.post<User>('/users', userData)
  },

  // Actualizar un usuario
  async updateUser(id: string, userData: UpdateUserRequest): Promise<ApiResponse<User>> {
    return apiClient.put<User>(`/users/${id}`, userData)
  },

  // Eliminar un usuario
  async deleteUser(id: string): Promise<ApiResponse<{ message: string; deletedUser: { id: string; email: string } }>> {
    return apiClient.delete(`/users/${id}`)
  },
}

export const usersService = {
  async getProfile(): Promise<UserProfile> {
    const response = await fetch(resolveApiPath('/api/user/profile'))
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Error al obtener perfil')
    }
    return data as UserProfile
  },

  async updateProfile(payload: UpdateUserProfileData): Promise<UserProfile> {
    const response = await fetch(resolveApiPath('/api/user/profile'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Error al actualizar perfil')
    }
    return data as UserProfile
  },

  async uploadProfileImage(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(resolveApiPath('/api/user/profile/upload'), {
      method: 'POST',
      body: formData,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Error al subir imagen')
    }
    return { url: data.profileImage as string }
  },
}

// Funciones helper para verificar el resultado de las llamadas API
export function isSuccess<T>(response: ApiResponse<T>): response is { data: T } {
  return !response.error && response.data !== undefined
}

export function isError<T>(response: ApiResponse<T>): response is { error: string } {
  return response.error !== undefined
}
