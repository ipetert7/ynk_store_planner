import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/lib/utils/permissions'
import bcrypt from 'bcryptjs'

type SyncUser = {
  id: number
  username: string
  full_name: string
  email: string
  is_active: boolean
  roles: string[]
  permissions: string[]
}

function isAdmin(user: SyncUser): boolean {
  return Array.isArray(user.roles) && user.roles.includes('admin')
}

function hasRentPermission(user: SyncUser): boolean {
  return Array.isArray(user.permissions) && user.permissions.includes('access_rent_manager')
}

function mapRole(user: SyncUser): UserRole {
  if (isAdmin(user)) {
    return UserRole.ADMINISTRADOR
  }
  if (hasRentPermission(user)) {
    return UserRole.GESTOR
  }
  return UserRole.VISUALIZADOR
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.SSO_SYNC_SECRET}`
  if (!process.env.SSO_SYNC_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncUrl = process.env.SSO_SYNC_URL
  if (!syncUrl) {
    return NextResponse.json({ error: 'Missing SSO_SYNC_URL' }, { status: 500 })
  }

  const response = await fetch(syncUrl, {
    headers: {
      authorization: expected,
    },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Sync source error' }, { status: 502 })
  }

  const data = await response.json()
  const users = (data.users || []) as SyncUser[]

  let upserts = 0
  const passwordHash = await bcrypt.hash('sso-managed', 10)
  for (const user of users) {
    const email = user.email || `${user.username}@ynk.local`
    const role = mapRole(user)
    const isActive = Boolean(user.is_active) && (isAdmin(user) || hasRentPermission(user))

    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: user.full_name,
        password: passwordHash,
        role,
        profileImage: null,
        externalId: user.id,
        username: user.username,
        isActive,
      },
      update: {
        name: user.full_name,
        role,
        externalId: user.id,
        username: user.username,
        isActive,
      },
    })
    upserts += 1
  }

  return NextResponse.json({ ok: true, count: upserts })
}
