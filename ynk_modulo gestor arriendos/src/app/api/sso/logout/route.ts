import { NextRequest, NextResponse } from 'next/server'

function sessionCookieNames(): string[] {
  return ['next-auth.session-token', '__Secure-next-auth.session-token']
}

function getPublicOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')

  if (host) {
    return `${forwardedProto || request.nextUrl.protocol.replace(':', '') || 'http'}://${host}`
  }

  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/logout?from=arriendos', getPublicOrigin(request)))
  const secure = (process.env.NEXTAUTH_URL || '').startsWith('https://')

  sessionCookieNames().forEach((name) => {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 0,
    })
  })

  return response
}
