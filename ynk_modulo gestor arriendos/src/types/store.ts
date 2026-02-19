export enum StoreStatus {
  ACTIVE = 'ACTIVE',
  TERMINATED = 'TERMINATED',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  TERMINATE = 'TERMINATE',
  CREATE_TEMPORARY_MODIFICATION = 'CREATE_TEMPORARY_MODIFICATION',
  DELETE_TEMPORARY_MODIFICATION = 'DELETE_TEMPORARY_MODIFICATION',
  EXPIRE_TEMPORARY_MODIFICATION = 'EXPIRE_TEMPORARY_MODIFICATION',
}

export enum RentIncreaseType {
  ANNUAL = 'ANNUAL',
  SPECIFIC_DATES = 'SPECIFIC_DATES',
}

export enum GuaranteeType {
  CASH = 'CASH',
  BANK_GUARANTEE = 'BANK_GUARANTEE',
}

export enum Currency {
  CLP = 'CLP',
  UF = 'UF',
}

export interface Store {
  id: string
  erpId: string
  storeName: string
  banner: string
  surfaceAreaHall: number
  surfaceAreaTotal: number
  surfaceAreaWarehouse: number // Calculado: surfaceAreaTotal - surfaceAreaHall
  shoppingCenterOperator: string
  contractStartDate: Date
  contractEndDate: Date
  contractDuration: number
  minimumMonthlyRent: number
  percentageRent: number
  decemberFactor: number
  commonExpenses: number
  promotionFund: number
  notificationPeriodDays: number
  status: StoreStatus
  createdAt: Date
  updatedAt: Date
  activeModification?: TemporaryModification

  // Nuevos campos para renovación automática, aumentos y garantía
  autoRenewal: boolean
  rentIncreaseType?: RentIncreaseType | null
  annualRentIncreasePercentage?: number | null
  guaranteeType?: GuaranteeType | null
  guaranteeAmount?: number | null
  guaranteeCurrency?: Currency | null
  rentIncreaseDates?: RentIncreaseDate[]
}

export interface StoreFormData {
  storeName: string
  banner: string
  erpId: string
  surfaceAreaHall: number
  surfaceAreaTotal: number
  shoppingCenterOperator: string
  contractStartDate: string
  contractEndDate: string
  contractDuration: number
  minimumMonthlyRent: number
  percentageRent: number
  decemberFactor: number
  commonExpenses: number
  promotionFund: number
  notificationPeriodDays: number

  // Nuevos campos para renovación automática, aumentos y garantía
  autoRenewal: boolean
  rentIncreaseType?: RentIncreaseType | null
  annualRentIncreasePercentage?: number | null
  rentIncreaseDates?: RentIncreaseDateFormData[]
  guaranteeType?: GuaranteeType | null
  guaranteeAmount?: number | null
  guaranteeCurrency?: Currency | null
}

export interface AuditLog {
  id: string
  userId: string
  storeId: string
  action: AuditAction
  fieldChanged: string | null
  oldValue: string | null
  newValue: string | null
  timestamp: Date
  user?: {
    name: string
    email: string
  }
}

export type SortField =
  | 'storeName'
  | 'banner'
  | 'shoppingCenterOperator'
  | 'surfaceAreaTotal'
  | 'minimumMonthlyRent'
  | 'contractEndDate'
  | 'contractStartDate'
  | 'percentageRent'
  | 'createdAt'
  | 'updatedAt'

export type SortOrder = 'asc' | 'desc'

export interface StoreSort {
  field: SortField | null
  order: SortOrder
}

export interface StoreFilters {
  search: string
  status: StoreStatus | 'ALL'
  operator: string
  surfaceMin: number | null
  surfaceMax: number | null
  vmmMin: number | null
  vmmMax: number | null
  dateFrom: string | null
  dateTo: string | null
}

export interface TemporaryModification {
  id: string
  storeId: string
  startDate: Date
  endDate: Date
  minimumMonthlyRent: number
  percentageRent: number
  decemberFactor: number
  originalMinimumMonthlyRent: number
  originalPercentageRent: number
  originalDecemberFactor: number
  createdAt: Date
  updatedAt: Date
}

export interface TemporaryModificationFormData {
  startDate: string
  endDate: string
  minimumMonthlyRent: number
  percentageRent: number
  decemberFactor: number
}

export interface RentIncreaseDate {
  id: string
  storeId: string
  increaseDate: Date
  increasePercentage: number
  createdAt: Date
  updatedAt: Date
}

export interface RentIncreaseDateFormData {
  id?: string
  increaseDate: string
  increasePercentage: number
}
