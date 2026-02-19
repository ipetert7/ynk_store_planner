import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encodeNextAuthSessionToken, getNextAuthSessionCookieName, isSecureNextAuthCookie } from '@/lib/sso-auth'
import { UserRole } from '@/lib/utils/permissions'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const BASE_PATH = '/arriendos'

type SsoPayload = {
  sub: string
  username: string
  email: string
  full_name: string
  is_active: boolean
  roles: string[]
  permissions: string[]
  exp: number
}

function isAdmin(payload: SsoPayload): boolean {
  return Array.isArray(payload.roles) && payload.roles.includes('admin')
}

function hasRentPermission(payload: SsoPayload): boolean {
  return Array.isArray(payload.permissions) && payload.permissions.includes('access_rent_manager')
}

function mapRole(payload: SsoPayload): UserRole {
  if (isAdmin(payload)) {
    return UserRole.ADMINISTRADOR
  }
  return UserRole.GESTOR
}

function safeCallbackUrl(value: string | null): string {
  if (!value) return BASE_PATH
  if (value.startsWith(BASE_PATH)) return value
  return BASE_PATH
}

function clearSessionCookies(response: NextResponse): void {
  response.cookies.set('next-auth.session-token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 0,
  })

  response.cookies.set('__Secure-next-auth.session-token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
  })
}

function loginRedirect(publicOrigin: string, nextPath: string, clearCookies: boolean = false): NextResponse {
  const loginUrl = new URL('/login', publicOrigin)
  loginUrl.searchParams.set('next', nextPath)

  const response = NextResponse.redirect(loginUrl)
  if (clearCookies) {
    clearSessionCookies(response)
    response.cookies.set('ynk_sso', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 0,
    })
  }
  return response
}

function isSsoDebugEnabled(): boolean {
  return process.env.SSO_DEBUG === 'true'
}

function logSso(message: string, meta?: Record<string, unknown>): void {
  if (!isSsoDebugEnabled()) return
  console.log('[sso-consume]', message, meta || {})
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

function verifyJwt(token: string, secret: string): SsoPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts
  const data = `${headerB64}.${payloadB64}`
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  if (expected !== signatureB64) return null

  const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8')
  const payload = JSON.parse(payloadJson) as SsoPayload
  if (payload.exp && Date.now() / 1000 > payload.exp) return null
  return payload
}

export async function GET(request: NextRequest) {
  const ssoSecret = process.env.SSO_SECRET
  const nextAuthSecret = process.env.NEXTAUTH_SECRET
  const publicOrigin = getPublicOrigin(request)

  if (!ssoSecret || !nextAuthSecret) {
    return NextResponse.json({ error: 'Missing SSO configuration' }, { status: 500 })
  }

  const ssoCookie = request.cookies.get('ynk_sso')?.value
  if (!ssoCookie) {
    return loginRedirect(publicOrigin, BASE_PATH)
  }

  try {
    logSso('processing sso cookie', {
      callbackUrl: request.nextUrl.searchParams.get('callbackUrl'),
      hasSsoCookie: Boolean(ssoCookie),
    })

    const ssoPayload = verifyJwt(ssoCookie, ssoSecret)
    if (!ssoPayload) {
      return loginRedirect(publicOrigin, BASE_PATH, true)
    }

    if (!ssoPayload.is_active) {
      return loginRedirect(publicOrigin, BASE_PATH, true)
    }

    if (!isAdmin(ssoPayload) && !hasRentPermission(ssoPayload)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const email = ssoPayload.email || `${ssoPayload.username}@ynk.local`
    const role = mapRole(ssoPayload)

    const passwordHash = await bcrypt.hash('sso-managed', 10)
    const externalId = Number.isNaN(Number(ssoPayload.sub)) ? null : Number(ssoPayload.sub)
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: ssoPayload.full_name,
        password: passwordHash,
        role,
        profileImage: null,
        externalId,
        username: ssoPayload.username,
        isActive: ssoPayload.is_active,
      },
      update: {
        name: ssoPayload.full_name,
        role,
        externalId,
        username: ssoPayload.username,
        isActive: ssoPayload.is_active,
      },
    })

    const token = await encodeNextAuthSessionToken({
      secret: nextAuthSecret,
      token: {
        sub: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage || null,
        role: user.role,
      },
    })

    const response = NextResponse.redirect(new URL(safeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl')), publicOrigin))

    const sessionCookieName = getNextAuthSessionCookieName()
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureNextAuthCookie(),
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    logSso('session cookie issued', {
      sessionCookieName,
      callbackUrl: safeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl')),
      userEmail: user.email,
    })

    return response
  } catch (error) {
    console.error('SSO consume error:', error)
    return loginRedirect(publicOrigin, BASE_PATH, true)
  }
}
