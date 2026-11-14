export type BusinessRole = 'owner' | 'staff';

export function isBusinessRole(value: unknown): value is BusinessRole {
  return value === 'owner' || value === 'staff';
}

export function canAccessSales(role: BusinessRole | null): boolean {
  return role === 'owner' || role === 'staff';
}

export function canAccessOwnerSections(role: BusinessRole | null): boolean {
  return role === 'owner';
}
