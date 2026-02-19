import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateUserSession } from '@/lib/utils/user'
import { storeService } from '@/services/store.service'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await validateUserSession(session)

    const operators = await storeService.getUniqueShoppingCenterOperators()
    return NextResponse.json(operators)
  } catch (error) {
    console.error('Error fetching shopping center operators:', error)

    return NextResponse.json(
      { error: 'Error al obtener operadores de centro comercial' },
      { status: 500 }
    )
  }
}
