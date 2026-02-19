'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // TODO: Log to error reporting service in production
    // Example: logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <Card>
            <CardContent className="p-8 text-center max-w-md">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Algo salió mal
              </h2>
              <p className="text-gray-600 mb-6">
                Ocurrió un error inesperado. Por favor, intenta nuevamente.
              </p>
              {this.state.error && process.env.NODE_ENV === 'development' && (
                <p className="text-sm text-red-600 mb-6 bg-red-50 p-3 rounded text-left font-mono">
                  {this.state.error.message}
                </p>
              )}
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={this.handleReset}
                  variant="primary"
                >
                  Intentar de nuevo
                </Button>
                <Button
                  onClick={() => window.location.href = '/'}
                  variant="secondary"
                >
                  Volver al inicio
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

