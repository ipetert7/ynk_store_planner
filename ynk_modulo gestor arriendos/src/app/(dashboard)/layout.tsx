'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Avatar from '@/components/ui/Avatar'
import ErrorBoundary from '@/components/ErrorBoundary'

function Breadcrumbs() {
  const pathname = usePathname()
  
  if (pathname === '/') return null
  
  const paths = pathname.split('/').filter(Boolean)
  const breadcrumbs = paths.map((path, index) => {
    // Para el primer segmento "stores", apuntar a la página principal "/" en lugar de "/stores"
    const href = (index === 0 && path === 'stores') ? '/' : '/' + paths.slice(0, index + 1).join('/')
    const label = path === 'stores' ? 'Tiendas' :
                  path === 'expiring' ? 'Contratos Próximos a Vencer' :
                  path === 'new' ? 'Nueva Tienda' :
                  path === 'edit' ? 'Editar' :
                  /^[0-9a-f-]+$/.test(path) ? 'Detalle' :
                  path.charAt(0).toUpperCase() + path.slice(1)

    return { href, label, isLast: index === paths.length - 1 }
  })
  
  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm">
        <li>
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            Inicio
          </Link>
        </li>
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center">
            <span className="mx-2 text-gray-400">/</span>
            {crumb.isLast ? (
              <span className="text-gray-900 font-medium" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="text-gray-500 hover:text-gray-700">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const logoSrc = '/arriendos/images/logo.png'
  const ssoLogoutPath = '/arriendos/api/sso/logout'
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // No renderizar el contenido del usuario hasta que la sesión esté cargada
  const isLoadingSession = status === 'loading'

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false)
      }
    }

    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [userDropdownOpen])

  // Cerrar dropdown al cambiar de ruta
  useEffect(() => {
    setUserDropdownOpen(false)
  }, [pathname])


  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>
        
        <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 pt-4">
          <div className="flex items-center justify-between h-16">
            {/* Left section: Logo + Navigation */}
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link 
                href="/" 
                className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-shrink-0"
                aria-label="Ir al inicio"
              >
                <img
                  src={logoSrc}
                  alt="YNK Logo"
                  className="h-10 w-auto object-contain -mt-5"
                />
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-gray-900 leading-none">
                    Gestor de Arriendos
                  </h1>
                </div>
              </Link>
            </div>
            
            {/* Right section: User Menu */}
            <div className="flex items-center gap-4">
              {!isLoadingSession && (
                <>
                  <div className="hidden sm:flex sm:items-center">
                    <div className="relative" ref={userDropdownRef}>
                      <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className="flex items-center gap-3 text-right min-h-[2.5rem] px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                        aria-label="Menú de usuario"
                        aria-expanded={userDropdownOpen}
                        aria-haspopup="true"
                      >
                        <Avatar
                          src={session?.user?.profileImage || undefined}
                          name={session?.user?.name || undefined}
                          size="sm"
                        />
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-gray-900">
                            {session?.user?.name || 'Usuario'}
                          </p>
                          {session?.user?.name !== 'Administrador' && (
                            <p className="text-xs text-gray-500">
                              {session?.user?.email}
                            </p>
                          )}
                        </div>
                        <svg
                          className={`ml-2 h-5 w-5 text-gray-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {userDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                router.push('/profile')
                                setUserDropdownOpen(false)
                              }}
                              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            >
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Perfil de usuario
                            </button>
                            <button
                              onClick={() => {
                                router.push('/settings')
                                setUserDropdownOpen(false)
                              }}
                              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            >
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Ajustes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:block h-8 w-px bg-gray-300" />
                </>
              )}
              <button
                onClick={() => window.location.assign(ssoLogoutPath)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Salir del gestor"
                disabled={isLoadingSession}
              >
                <span className="hidden sm:inline">Salir del gestor</span>
                <svg className="sm:hidden h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
              
              {/* Mobile menu button */}
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-colors"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <span className="sr-only">Abrir menú principal</span>
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white" id="mobile-menu">
            {!isLoadingSession && (
              <div className="px-4 pt-4 pb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar
                      src={session?.user?.profileImage || undefined}
                      name={session?.user?.name || undefined}
                      size="md"
                    />
                    <div className="flex flex-col text-left">
                      <p className="text-base font-medium text-gray-900">
                        {session?.user?.name || 'Usuario'}
                      </p>
                      {session?.user?.name !== 'Administrador' && (
                        <p className="text-sm text-gray-500 truncate">
                          {session?.user?.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      router.push('/profile')
                      setMobileMenuOpen(false)
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Perfil de usuario
                  </button>
                  <button
                    onClick={() => {
                      router.push('/settings')
                      setMobileMenuOpen(false)
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Ajustes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </nav>
      
        <main id="main-content" className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-10">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </ErrorBoundary>
  )
}

