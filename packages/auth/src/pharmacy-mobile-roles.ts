/** Roles that may mutate pharmacy inventory from the Expo BFF (receive, adjust, transfer). */
export const PHARMACY_INVENTORY_MUTATOR_ROLES = [
  'pharmacy_admin',
  'pharmacy_ceo',
  'pharmacist',
  'pharmacy_store_manager',
  'pharmacy_staff',
] as const

const MUTATOR = new Set<string>(PHARMACY_INVENTORY_MUTATOR_ROLES)

export function canMutatePharmacyInventory(role: string | null | undefined): boolean {
  return MUTATOR.has(String(role ?? ''))
}
