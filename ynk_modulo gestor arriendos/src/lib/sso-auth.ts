import { encode } from 'next-auth/jwt'
import type { JWT } from 'next-auth/jwt'

const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export function isSecureNextAuthCookie(nextAuthUrl: string = process.env.NEXTAUTH_URL || ''): boolean {
  return nextAuthUrl.startsWith('https://')
}

export function getNextAuthSessionCookieName(nextAuthUrl: string = process.env.NEXTAUTH_URL || ''): string {
  return isSecureNextAuthCookie(nextAuthUrl)
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'
}

export async function encodeNextAuthSessionToken(params: {
  secret: string
  token: JWT
  maxAge?: number
}): Promise<string> {
  return encode({
    secret: params.secret,
    maxAge: params.maxAge ?? DEFAULT_SESSION_MAX_AGE_SECONDS,
    token: params.token,
  })
}
