
import { prisma } from '@/lib/prisma'
import { StoreStatus, SortField, SortOrder, AuditAction } from '@/types/store'
import { getActiveModification, applyModification, cleanOperatorName, normalizeOperatorName } from '@/lib/utils/store'
import { auditService } from './audit.service'
import { calculateContractDuration } from '@/lib/utils'
import { Prisma } from '@prisma/client'

export interface GetStoresParams {
    search?: string
    status?: StoreStatus | 'ALL'
    operator?: string
    surfaceMin?: string | number
    surfaceMax?: string | number
    vmmMin?: string | number
    vmmMax?: string | number
    dateFrom?: string
    dateTo?: string
    sortBy?: SortField
    sortOrder?: SortOrder
    expiringMonths?: string | number
}

export interface GetStoreOptions {
    applyModifications?: boolean
}

export const storeService = {
    async getUniqueShoppingCenterOperators() {
        const stores = await prisma.store.findMany({
            where: {
                shoppingCenterOperator: {
                    not: '',
                },
            },
            select: {
                shoppingCenterOperator: true,
            },
            orderBy: {
                shoppingCenterOperator: 'asc',
            },
        })

        const canonicalByNormalized = new Map<string, string>()

        for (const row of stores) {
            const canonical = cleanOperatorName(row.shoppingCenterOperator)
            const normalized = normalizeOperatorName(canonical)

            if (normalized && !canonicalByNormalized.has(normalized)) {
                canonicalByNormalized.set(normalized, canonical)
            }
        }

        return Array.from(canonicalByNormalized.values()).sort((a, b) =>
            a.localeCompare(b, 'es', { sensitivity: 'base' })
        )
    },

    async canonicalizeShoppingCenterOperator(operatorInput: string | null | undefined) {
        const cleaned = cleanOperatorName(operatorInput)

        if (!cleaned) {
            return ''
        }

        const normalizedInput = normalizeOperatorName(cleaned)
        const existingOperators = await this.getUniqueShoppingCenterOperators()

        const canonical = existingOperators.find((operator) => normalizeOperatorName(operator) === normalizedInput)
        return canonical ?? cleaned
    },

    async getById(id: string, options: GetStoreOptions = { applyModifications: true }) {
        const store = await prisma.store.findUnique({
            where: { id },
            include: {
                rentIncreaseDates: true,
            },
        })

        if (!store) return null

        let activeModification = null
        try {
            const modifications = await prisma.temporaryModification.findMany({
                where: { storeId: id },
            })

            const modificationsWithDates = modifications.map((mod) => ({
                ...mod,
                startDate: new Date(mod.startDate),
                endDate: new Date(mod.endDate),
                createdAt: new Date(mod.createdAt),
                updatedAt: new Date(mod.updatedAt),
            }))

            const today = new Date()
            activeModification = getActiveModification(modificationsWithDates, today)
        } catch (error) {
            console.error(`Error fetching modifications for store ${id}: `, error)
        }

        const baseStore = {
            ...store,
            activeModification: activeModification || undefined,
            surfaceAreaWarehouse: store.surfaceAreaTotal - store.surfaceAreaHall
        }

        if (options.applyModifications && activeModification) {
            const modifiedStore = applyModification(baseStore as any, activeModification)
            return {
                ...modifiedStore,
                surfaceAreaWarehouse: modifiedStore.surfaceAreaTotal - modifiedStore.surfaceAreaHall
            }
        }

        return baseStore
    },

    async getAll(params: GetStoresParams = {}) {
        const {
            search,
            status,
            operator,
            surfaceMin,
            surfaceMax,
            vmmMin,
            vmmMax,
            dateFrom,
            dateTo,
            sortBy,
            sortOrder = 'asc',
            expiringMonths,
        } = params

        const where: Prisma.StoreWhereInput = {}

        // Status Filter
        if (status) {
            if (status !== 'ALL') {
                where.status = status
            }
        } else {
            where.status = 'ACTIVE'
        }

        // Search Filter
        if (search) {
            where.OR = [
                { storeName: { contains: search } },
                { banner: { contains: search } },
                { shoppingCenterOperator: { contains: search } },
                { erpId: { contains: search } },
            ]
        }

        // Operator Filter
        if (operator) {
            where.shoppingCenterOperator = operator
        }

        // Surface Filter
        if (surfaceMin !== undefined && surfaceMin !== null || surfaceMax !== undefined && surfaceMax !== null) {
            where.surfaceAreaTotal = {}
            if (surfaceMin !== undefined && surfaceMin !== null) {
                where.surfaceAreaTotal.gte = typeof surfaceMin === 'string' ? parseFloat(surfaceMin) : surfaceMin
            }
            if (surfaceMax !== undefined && surfaceMax !== null) {
                where.surfaceAreaTotal.lte = typeof surfaceMax === 'string' ? parseFloat(surfaceMax) : surfaceMax
            }
        }

        // VMM Filter
        if (vmmMin !== undefined && vmmMin !== null || vmmMax !== undefined && vmmMax !== null) {
            where.minimumMonthlyRent = {}
            if (vmmMin !== undefined && vmmMin !== null) {
                where.minimumMonthlyRent.gte = typeof vmmMin === 'string' ? parseFloat(vmmMin) : vmmMin
            }
            if (vmmMax !== undefined && vmmMax !== null) {
                where.minimumMonthlyRent.lte = typeof vmmMax === 'string' ? parseFloat(vmmMax) : vmmMax
            }
        }

        // Date Filter
        if (dateFrom || dateTo) {
            where.contractEndDate = {}
            if (dateFrom) {
                where.contractEndDate.gte = new Date(dateFrom)
            }
            if (dateTo) {
                const dateToEnd = new Date(dateTo)
                dateToEnd.setHours(23, 59, 59, 999)
                where.contractEndDate.lte = dateToEnd
            }
        }

        // Expiring Months Filter
        if (expiringMonths) {
            const months = typeof expiringMonths === 'string' ? parseInt(expiringMonths) : expiringMonths
            const today = new Date()
            const futureDate = new Date()
            futureDate.setMonth(today.getMonth() + months)
            where.contractEndDate = {
                gte: today,
                lte: futureDate,
            }
            where.status = 'ACTIVE'
        }

        // Sorting
        const validSortFields: SortField[] = [
            'storeName',
            'banner',
            'shoppingCenterOperator',
            'surfaceAreaTotal',
            'minimumMonthlyRent',
            'contractEndDate',
            'contractStartDate',
            'percentageRent',
            'createdAt',
            'updatedAt',
        ]

        let orderBy: Prisma.StoreOrderByWithRelationInput = { contractEndDate: 'asc' }

        if (sortBy && validSortFields.includes(sortBy)) {
            orderBy = {
                [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
            }
        }

        const stores = await prisma.store.findMany({
            where,
            orderBy,
            include: {
                rentIncreaseDates: true,
            },
        })

        // Apply active modifications
        const today = new Date()
        const storesWithModifications = await Promise.all(
            stores.map(async (store) => {
                try {
                    const modifications = await prisma.temporaryModification.findMany({
                        where: { storeId: store.id },
                    })

                    const modificationsWithDates = modifications.map((mod) => ({
                        ...mod,
                        startDate: new Date(mod.startDate),
                        endDate: new Date(mod.endDate),
                        createdAt: new Date(mod.createdAt),
                        updatedAt: new Date(mod.updatedAt),
                    }))

                    const activeModification = getActiveModification(modificationsWithDates, today)

                    if (activeModification) {
                        const modifiedStore = applyModification(store as any, activeModification)
                        return {
                            ...modifiedStore,
                            surfaceAreaWarehouse: modifiedStore.surfaceAreaTotal - modifiedStore.surfaceAreaHall
                        }
                    }

                    return {
                        ...store,
                        surfaceAreaWarehouse: store.surfaceAreaTotal - store.surfaceAreaHall
                    }
                } catch (error) {
                    console.error(`Error processing modifications for store ${store.id}: `, error)
                    return {
                        ...store,
                        surfaceAreaWarehouse: store.surfaceAreaTotal - store.surfaceAreaHall
                    }
                }
            })
        )

        return storesWithModifications as any // Temporary cast to avoid complex type matching, or strictly map to Store interface
    },

    async create(data: any, userId: string) {
        const {
            storeName,
            banner,
            erpId,
            surfaceAreaHall,
            surfaceAreaTotal,
            shoppingCenterOperator,
            contractStartDate,
            contractEndDate,
            minimumMonthlyRent,
            percentageRent,
            decemberFactor,
            commonExpenses,
            promotionFund,
            notificationPeriodDays,
            autoRenewal,
            rentIncreaseType,
            annualRentIncreasePercentage,
            rentIncreaseDates,
            guaranteeType,
            guaranteeAmount,
            guaranteeCurrency,
        } = data

        const startDate = new Date(contractStartDate)
        const endDate = new Date(contractEndDate)
        const contractDuration = calculateContractDuration(startDate, endDate)

        // Check for existing store
        const existingStore = await prisma.store.findUnique({
            where: { erpId },
        })

        if (existingStore) {
            throw new Error('Ya existe una tienda con este ID del ERP')
        }

        const canonicalOperator = await this.canonicalizeShoppingCenterOperator(shoppingCenterOperator)

        return prisma.$transaction(async (tx) => {
            const store = await tx.store.create({
                data: {
                    storeName,
                    banner,
                    erpId,
                    surfaceAreaHall: surfaceAreaHall || 0,
                    surfaceAreaTotal: surfaceAreaTotal || 0,
                    shoppingCenterOperator: canonicalOperator,
                    contractStartDate: startDate,
                    contractEndDate: endDate,
                    contractDuration,
                    minimumMonthlyRent: minimumMonthlyRent || 0,
                    percentageRent: percentageRent || 0,
                    decemberFactor: decemberFactor ?? 1,
                    commonExpenses: commonExpenses || 0,
                    promotionFund: promotionFund || 0,
                    notificationPeriodDays: notificationPeriodDays || 0,
                    status: StoreStatus.ACTIVE,
                    autoRenewal: autoRenewal || false,
                    rentIncreaseType,
                    annualRentIncreasePercentage: annualRentIncreasePercentage ?? null,
                    guaranteeType,
                    guaranteeAmount: guaranteeAmount ?? null,
                    guaranteeCurrency,
                },
            })

            if (rentIncreaseDates && Array.isArray(rentIncreaseDates) && rentIncreaseDates.length > 0) {
                await tx.rentIncreaseDate.createMany({
                    data: rentIncreaseDates.map((date: any) => ({
                        storeId: store.id,
                        increaseDate: new Date(date.increaseDate),
                        increasePercentage: date.increasePercentage || 0,
                    })),
                })
            }

            await auditService.create({
                userId,
                storeId: store.id,
                action: AuditAction.CREATE,
                fieldChanged: null,
                oldValue: null,
                newValue: null,
            }, tx)

            return store
        })
    },

    async update(id: string, data: any, userId: string) {
        const {
            storeName,
            banner,
            erpId,
            surfaceAreaHall,
            surfaceAreaTotal,
            shoppingCenterOperator,
            contractStartDate,
            contractEndDate,
            minimumMonthlyRent,
            percentageRent,
            decemberFactor,
            commonExpenses,
            promotionFund,
            notificationPeriodDays,
            autoRenewal,
            rentIncreaseType,
            annualRentIncreasePercentage,
            rentIncreaseDates,
            guaranteeType,
            guaranteeAmount,
            guaranteeCurrency,
        } = data

        const startDate = new Date(contractStartDate)
        const endDate = new Date(contractEndDate)
        const contractDuration = calculateContractDuration(startDate, endDate)
        const canonicalOperator = await this.canonicalizeShoppingCenterOperator(shoppingCenterOperator)

        return prisma.$transaction(async (tx) => {
            const currentStore = await tx.store.findUnique({
                where: { id },
                include: { rentIncreaseDates: true }
            })

            if (!currentStore) {
                throw new Error('Tienda no encontrada')
            }

            // Check if erpId is being changed and if it conflicts
            if (erpId !== currentStore.erpId) {
                const existingStore = await tx.store.findUnique({
                    where: { erpId },
                })
                if (existingStore) {
                    throw new Error('Ya existe una tienda con este ID del ERP')
                }
            }

            const updatedStore = await tx.store.update({
                where: { id },
                data: {
                    storeName,
                    banner,
                    erpId,
                    surfaceAreaHall: surfaceAreaHall || 0,
                    surfaceAreaTotal: surfaceAreaTotal || 0,
                    shoppingCenterOperator: canonicalOperator,
                    contractStartDate: startDate,
                    contractEndDate: endDate,
                    contractDuration,
                    minimumMonthlyRent: minimumMonthlyRent || 0,
                    percentageRent: percentageRent || 0,
                    decemberFactor: decemberFactor ?? 1,
                    commonExpenses: commonExpenses || 0,
                    promotionFund: promotionFund || 0,
                    notificationPeriodDays: notificationPeriodDays || 0,
                    autoRenewal: autoRenewal || false,
                    rentIncreaseType,
                    annualRentIncreasePercentage: annualRentIncreasePercentage ?? null,
                    guaranteeType,
                    guaranteeAmount: guaranteeAmount ?? null,
                    guaranteeCurrency,
                },
            })

            // Handle Rent Increase Dates
            // Strategy: Delete all existing and recreate (simplest for now)
            await tx.rentIncreaseDate.deleteMany({
                where: { storeId: id }
            })

            if (rentIncreaseDates && Array.isArray(rentIncreaseDates) && rentIncreaseDates.length > 0) {
                await tx.rentIncreaseDate.createMany({
                    data: rentIncreaseDates.map((date: any) => ({
                        storeId: id,
                        increaseDate: new Date(date.increaseDate),
                        increasePercentage: date.increasePercentage || 0,
                    })),
                })
            }

            // Audit Logs (Simplified: Just one log for "UPDATE", ideally we log changed fields)
            // Determining what changed could be complex, for now fetching old and new helps usage, 
            // but let's just log the action "UPDATE" and maybe important fields if changed.
            // For this phase, a generic update log is sufficient or we can compare a few key fields.

            const fieldsToCheck = [
                'storeName', 'banner', 'erpId', 'surfaceAreaHall', 'surfaceAreaTotal',
                'contractStartDate', 'contractEndDate', 'minimumMonthlyRent', 'percentageRent'
            ]

            for (const field of fieldsToCheck) {
                if ((currentStore as any)[field] !== (updatedStore as any)[field]) {
                    // Simple comparison, might need safe string conversion
                    await auditService.create({
                        userId,
                        storeId: id,
                        action: AuditAction.UPDATE,
                        fieldChanged: field,
                        oldValue: String((currentStore as any)[field]),
                        newValue: String((updatedStore as any)[field]),
                    }, tx)
                }
            }

            // Also generic update log if needed, but field level is better. 
            // If no fields in list changed but others did (e.g. increase dates), we might want a generic log.
            // But let's stick to the loop for now.

            const finalStore = {
                ...updatedStore,
                surfaceAreaWarehouse: updatedStore.surfaceAreaTotal - updatedStore.surfaceAreaHall
            }

            return finalStore
        })
    }
}
