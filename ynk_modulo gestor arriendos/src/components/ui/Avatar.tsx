import React from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  }

  // Obtener iniciales del nombre
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase()
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }

  const initials = getInitials(name)

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium text-gray-700 bg-gray-200 overflow-hidden',
        sizes[size],
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Usuario'}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="select-none">{initials}</span>
      )}
    </div>
  )
}

