import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const BASE_PATH = '/arriendos'
const BYPASS_PREFIXES = ['/api/auth', '/api/sso/consume', '/api/sso/logout', '/api/sso/sync', '/_next', '/images']

export type AuthDecision =
  | { action: 'next' }
  | { action: 'redirect-root' }
  | { action: 'redirect-sso-consume'; callbackPath: string }
  | { action: 'redirect-login'; callbackPath: string }

export function resolveAuthDecision(params: {
  internalPath: string
  search: string
  hasToken: boolean
  hasSsoCookie: boolean
}): AuthDecision {
  const callbackPath = buildCallbackPath(params.internalPath, params.search)

  if (shouldBypassAuth(params.internalPath)) {
    return { action: 'next' }
  }

  if (params.hasToken) {
    if (params.internalPath === '/login') {
      return { action: 'redirect-root' }
    }
    return { action: 'next' }
  }

  if (params.hasSsoCookie) {
    return { action: 'redirect-sso-consume', callbackPath }
  }

  return { action: 'redirect-login', callbackPath }
}

export function getInternalPath(pathname: string): string {
  if (!pathname.startsWith(BASE_PATH)) return pathname
  return pathname.slice(BASE_PATH.length) || '/'
}

function shouldBypassAuth(internalPath: string): boolean {
  if (internalPath === '/favicon.ico') return true
  return BYPASS_PREFIXES.some((prefix) => internalPath.startsWith(prefix))
}

function buildCallbackPath(internalPath: string, search: string): string {
  const normalizedInternalPath = internalPath === '/login' ? '/' : internalPath
  return `${BASE_PATH}${normalizedInternalPath === '/' ? '' : normalizedInternalPath}${search}`
}

function isSsoDebugEnabled(): boolean {
  return process.env.SSO_DEBUG === 'true'
}

function logDecision(internalPath: string, decision: AuthDecision, hasToken: boolean, hasSsoCookie: boolean): void {
  if (!isSsoDebugEnabled()) return
  console.log('[sso-middleware]', {
    internalPath,
    decision,
    hasToken,
    hasSsoCookie,
  })
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const internalPath = getInternalPath(pathname)

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const ssoCookie = req.cookies.get('ynk_sso')?.value
  const decision = resolveAuthDecision({
    internalPath,
    search,
    hasToken: Boolean(token),
    hasSsoCookie: Boolean(ssoCookie),
  })

  logDecision(internalPath, decision, Boolean(token), Boolean(ssoCookie))

  if (decision.action === 'next') {
    return NextResponse.next()
  }

  if (decision.action === 'redirect-root') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (decision.action === 'redirect-sso-consume') {
    const url = req.nextUrl.clone()
    url.pathname = '/api/sso/consume'
    url.searchParams.set('callbackUrl', decision.callbackPath)
    return NextResponse.redirect(url)
  }

  const loginUrl = new URL('/login', req.nextUrl.origin)
  loginUrl.searchParams.set('next', decision.callbackPath)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/:path*'],
}
