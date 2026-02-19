import { prisma } from '@/lib/prisma'
import { AuditAction } from '@/types/store'
import { Prisma } from '@prisma/client'

export const auditService = {
  async create(data: {
    userId: string
    storeId: string
    action: AuditAction
    fieldChanged?: string | null
    oldValue?: string | null
    newValue?: string | null
  }, tx?: Prisma.TransactionClient) {
    const client = tx || prisma
    return client.auditLog.create({
      data,
    })
  }
}
