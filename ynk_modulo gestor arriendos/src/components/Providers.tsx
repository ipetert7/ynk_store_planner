'use client'

import { SessionProvider } from 'next-auth/react'
import ErrorBoundary from './ErrorBoundary'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log error for debugging
        console.error('Providers ErrorBoundary caught an error:', error, errorInfo)
      }}
    >
      <SessionProvider basePath="/arriendos/api/auth">
        {children}
      </SessionProvider>
    </ErrorBoundary>
  )
}
