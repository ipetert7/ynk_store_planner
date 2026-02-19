import type { Metadata } from 'next'
import { Sora } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: {
    default: 'Gestor de Arriendos - YNK',
    template: '%s | Gestor de Arriendos - YNK',
  },
  description: 'Sistema de gestión de arriendos de tiendas',
  icons: {
    icon: '/images/logo.png',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: '#4f46e5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`antialiased ${sora.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
