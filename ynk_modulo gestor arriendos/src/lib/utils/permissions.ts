import { Session } from 'next-auth'

// Enum de roles de usuario
export enum UserRole {
  VISUALIZADOR = 'VISUALIZADOR',
  GESTOR = 'GESTOR',
  ADMINISTRADOR = 'ADMINISTRADOR',
}

// Jerarquía de roles (mayor número = más permisos)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.VISUALIZADOR]: 1,
  [UserRole.GESTOR]: 2,
  [UserRole.ADMINISTRADOR]: 3,
}

// Tipos de acciones
export enum PermissionAction {
  VIEW_STORES = 'view_stores',
  MANAGE_STORES = 'manage_stores',
  TERMINATE_CONTRACTS = 'terminate_contracts',
  MANAGE_USERS = 'manage_users',
}

// Permisos por rol
const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  [UserRole.VISUALIZADOR]: [
    PermissionAction.VIEW_STORES,
  ],
  [UserRole.GESTOR]: [
    PermissionAction.VIEW_STORES,
    PermissionAction.MANAGE_STORES,
    PermissionAction.TERMINATE_CONTRACTS,
  ],
  [UserRole.ADMINISTRADOR]: [
    PermissionAction.VIEW_STORES,
    PermissionAction.MANAGE_STORES,
    PermissionAction.TERMINATE_CONTRACTS,
    PermissionAction.MANAGE_USERS,
  ],
}

/**
 * Verifica si un usuario tiene un permiso específico
 */
export function hasPermission(userRole: UserRole, action: PermissionAction): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || []
  return permissions.includes(action)
}

/**
 * Verifica si un usuario puede visualizar datos
 */
export function canView(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.VIEW_STORES)
}

/**
 * Verifica si un usuario puede gestionar tiendas (crear/modificar)
 */
export function canManageStores(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.MANAGE_STORES)
}

/**
 * Verifica si un usuario puede terminar contratos
 */
export function canTerminateContracts(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.TERMINATE_CONTRACTS)
}

/**
 * Verifica si un usuario puede gestionar usuarios
 */
export function canManageUsers(userRole: UserRole): boolean {
  return hasPermission(userRole, PermissionAction.MANAGE_USERS)
}

/**
 * Verifica si un rol tiene al menos el nivel mínimo requerido
 */
export function hasRoleLevel(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole]
}

/**
 * Requiere que la sesión tenga un rol específico o superior
 * Lanza error si no tiene permisos
 */
export function requireRole(session: Session | null, requiredRole: UserRole): void {
  if (!session) {
    throw new Error('No autorizado - sesión requerida')
  }

  if (!session.user?.role) {
    throw new Error('No autorizado - rol no definido')
  }

  const userRole = session.user.role as UserRole

  if (!hasRoleLevel(userRole, requiredRole)) {
    throw new Error(`No autorizado - se requiere rol ${requiredRole} o superior`)
  }
}

/**
 * Obtiene el rol de un usuario desde la sesión
 */
export function getUserRole(session: Session | null): UserRole | null {
  if (!session?.user?.role) {
    return null
  }

  return session.user.role as UserRole
}

/**
 * Verifica si el usuario es administrador
 */
export function isAdmin(session: Session | null): boolean {
  const role = getUserRole(session)
  return role === UserRole.ADMINISTRADOR
}

/**
 * Verifica si el usuario es gestor o administrador
 */
export function isManagerOrAdmin(session: Session | null): boolean {
  const role = getUserRole(session)
  return role === UserRole.GESTOR || role === UserRole.ADMINISTRADOR
}

/**
 * Obtiene la descripción legible de un rol
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case UserRole.VISUALIZADOR:
      return 'Visualizador'
    case UserRole.GESTOR:
      return 'Gestor'
    case UserRole.ADMINISTRADOR:
      return 'Administrador'
    default:
      return role
  }
}

/**
 * Obtiene todos los roles disponibles
 */
export function getAllRoles(): UserRole[] {
  return Object.values(UserRole)
}
