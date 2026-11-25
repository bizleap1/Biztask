export const CANONICAL_ROLES = [
  'SuperAdmin',
  'Manager',
  'TeamLead',
  'Employee',
  'ClientUser',
] as const;

export const LEGACY_ROLES = [
  'DevEmployee',
  'MediaEmployee',
  'Viewer',
] as const;

export const ALL_VALID_ROLES = [...CANONICAL_ROLES, ...LEGACY_ROLES] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

export function normalizeRole(role: string): string {
  if (role === 'DevEmployee' || role === 'MediaEmployee') {
    return 'Employee';
  }
  return role;
}

export function roleMatches(userRole: string, allowedRoles: string[]): boolean {
  if (allowedRoles.includes(userRole)) return true;
  const normalized = normalizeRole(userRole);
  return allowedRoles.includes(normalized);
}

/**
 * Defines which roles an actor is permitted to create or assign.
 * - SuperAdmin: any valid role
 * - Manager: TeamLead, Employee (and legacy DevEmployee, MediaEmployee)
 * - Others: none
 */
export function canGrantRole(actorRole: string, targetRole: string): boolean {
  if (!(ALL_VALID_ROLES as readonly string[]).includes(targetRole)) {
    return false;
  }
  if (actorRole === 'SuperAdmin') {
    return true;
  }
  if (actorRole === 'Manager') {
    return ['TeamLead', 'Employee', 'DevEmployee', 'MediaEmployee'].includes(targetRole);
  }
  return false;
}

export function isStaffRole(role: string): boolean {
  return role !== 'ClientUser';
}
