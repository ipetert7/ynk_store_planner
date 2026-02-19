#!/usr/bin/env tsx
import assert from 'node:assert/strict'
import { decode, encode } from 'next-auth/jwt'

import { resolveAuthDecision } from '../src/middleware'
import { encodeNextAuthSessionToken, getNextAuthSessionCookieName } from '../src/lib/sso-auth'

async function safeDecode(params: { secret: string; token: string }) {
  try {
    return await decode(params)
  } catch {
    return null
  }
}

function testCookieNameResolution() {
  assert.equal(getNextAuthSessionCookieName('http://localhost/arriendos'), 'next-auth.session-token')
  assert.equal(
    getNextAuthSessionCookieName('https://app.ynk.cl/arriendos'),
    '__Secure-next-auth.session-token'
  )
}

async function testSessionRoundtripWithoutSalt() {
  const secret = 'test-secret-ynk-sso'
  const token = await encodeNextAuthSessionToken({
    secret,
    token: {
      sub: 'user-1',
      id: 'user-1',
      name: 'User Test',
      email: 'user@test.cl',
      role: 'GESTOR',
    },
  })

  const decoded = await safeDecode({ secret, token })
  assert.ok(decoded, 'Expected session token to decode with NextAuth defaults')
  assert.equal(decoded?.sub, 'user-1')
}

async function testRegressionSaltMismatch() {
  const secret = 'test-secret-ynk-sso'
  const tokenWithCookieSalt = await encode({
    secret,
    salt: 'next-auth.session-token',
    token: {
      sub: 'user-1',
      id: 'user-1',
      role: 'GESTOR',
    },
  })

  const decoded = await safeDecode({ secret, token: tokenWithCookieSalt })
  assert.equal(decoded, null, 'Token encoded with cookie salt must fail default decode (loop regression)')
}

function testMiddlewareDecisions() {
  assert.deepEqual(
    resolveAuthDecision({
      internalPath: '/api/auth/session',
      search: '',
      hasToken: false,
      hasSsoCookie: false,
    }),
    { action: 'next' }
  )

  assert.deepEqual(
    resolveAuthDecision({
      internalPath: '/login',
      search: '',
      hasToken: true,
      hasSsoCookie: true,
    }),
    { action: 'redirect-root' }
  )

  assert.deepEqual(
    resolveAuthDecision({
      internalPath: '/stores',
      search: '?status=ACTIVE',
      hasToken: false,
      hasSsoCookie: true,
    }),
    { action: 'redirect-sso-consume', callbackPath: '/arriendos/stores?status=ACTIVE' }
  )

  assert.deepEqual(
    resolveAuthDecision({
      internalPath: '/stores',
      search: '?status=ACTIVE',
      hasToken: false,
      hasSsoCookie: false,
    }),
    { action: 'redirect-login', callbackPath: '/arriendos/stores?status=ACTIVE' }
  )
}

async function run() {
  testCookieNameResolution()
  await testSessionRoundtripWithoutSalt()
  await testRegressionSaltMismatch()
  testMiddlewareDecisions()

  console.log('OK - SSO auth regression tests passed')
}

run().catch((error) => {
  console.error('SSO auth regression tests failed:', error)
  process.exit(1)
})
