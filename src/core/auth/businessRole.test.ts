import { describe, expect, it } from 'vitest';
import { canAccessOwnerSections, canAccessSales, isBusinessRole } from './businessRole';

describe('business roles', () => {
  it('recognizes only supported app roles', () => {
    expect(isBusinessRole('owner')).toBe(true);
    expect(isBusinessRole('staff')).toBe(true);
    expect(isBusinessRole('admin')).toBe(false);
    expect(isBusinessRole(null)).toBe(false);
  });

  it('allows staff to sell but restricts all management sections to owners', () => {
    expect(canAccessSales('owner')).toBe(true);
    expect(canAccessSales('staff')).toBe(true);
    expect(canAccessSales(null)).toBe(false);
    expect(canAccessOwnerSections('owner')).toBe(true);
    expect(canAccessOwnerSections('staff')).toBe(false);
    expect(canAccessOwnerSections(null)).toBe(false);
  });
});
