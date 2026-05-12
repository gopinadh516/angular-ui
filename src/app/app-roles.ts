export const APP_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  AR_MANAGER: 'AR_MANAGER',
  AR_AGENT: 'AR_AGENT',
  CODE_AGENT: 'CODE_AGENT',
  CHARGE_AGENT: 'CHARGE_AGENT',
  PAY_AGENT: 'PAY_AGENT',
  CLIENT: 'CLIENT'
} as const;

export const AR_LIST_ROLES = [
  APP_ROLES.AR_AGENT,
  APP_ROLES.CODE_AGENT,
  APP_ROLES.CHARGE_AGENT,
  APP_ROLES.PAY_AGENT
] as const;

/**
 * Roles allowed to open "View AR Lists"
 * (/ar-lists and /ar-lists/:listNumber)
 */
export const VIEW_AR_LIST_ROLES = [
  APP_ROLES.SUPER_ADMIN,
  APP_ROLES.ADMIN,
  APP_ROLES.AR_MANAGER,
  APP_ROLES.AR_AGENT
] as const;

export const DASHBOARD_ROLES = [
  APP_ROLES.SUPER_ADMIN,
  APP_ROLES.ADMIN,
  APP_ROLES.AR_MANAGER
] as const;

export const CLIENT_ROLES = [
  APP_ROLES.CLIENT
] as const;

export function normalizeRole(role: string | null | undefined): string {
  return (role || '').replace(/^ROLE_/, '').trim().toUpperCase();
}

export function isArListRole(role: string | null | undefined): boolean {
  return AR_LIST_ROLES.includes(normalizeRole(role) as any);
}

export function isDashboardRole(role: string | null | undefined): boolean {
  return DASHBOARD_ROLES.includes(normalizeRole(role) as any);
}

export function isClientRole(role: string | null | undefined): boolean {
  return CLIENT_ROLES.includes(normalizeRole(role) as any);
}