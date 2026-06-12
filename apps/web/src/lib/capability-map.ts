// apps/web/src/lib/capability-map.ts
// Static mirror of the role_capabilities DB seed.
// Source of truth is the SQL lattice (has_capability RPC).
// This map is used for documentation and fast client-side guards only.

export type CapTuple = readonly [module: string, resource: string, action: string]

// Direct grants only — role_hierarchy handles inheritance
const DIRECT_GRANTS: Record<string, readonly CapTuple[]> = {
  nurse: [
    ['clinical', 'patient',   'read' ],
    ['clinical', 'encounter', 'read' ],
    ['clinical', 'encounter', 'write'],
  ],

  clinical_officer: [
    ['clinical', 'patient',      'write'],
    ['clinical', 'prescription', 'read' ],
    ['clinical', 'prescription', 'write'],
  ],

  doctor: [
    ['clinical', 'patient',      'delete'],
    ['clinical', 'encounter',    'delete'],
    ['clinical', 'prescription', 'admin' ],
    ['clinical', 'prescription', 'delete'],
    ['clinical', 'report',       'read'  ],
    ['clinical', 'report',       'write' ],
  ],

  receptionist: [
    ['clinical', 'patient', 'read' ],
    ['clinical', 'patient', 'write'],
    ['admin',    'report',  'read' ],
  ],

  pharmacist: [
    ['pharmacy', 'inventory',    'read' ],
    ['pharmacy', 'inventory',    'write'],
    ['pharmacy', 'prescription', 'read' ],
    ['pharmacy', 'prescription', 'write'],
    ['pharmacy', 'supply',       'read' ],
    ['pharmacy', 'supply',       'write'],
    ['pharmacy', 'report',       'read' ],
    ['clinical', 'prescription', 'read' ],
  ],

  lab_tech: [
    ['lab', 'sample', 'read' ],
    ['lab', 'sample', 'write'],
    ['lab', 'result', 'read' ],
    ['lab', 'result', 'write'],
    ['lab', 'result', 'admin'],
  ],

  // hospital_admin: all capabilities except platform module
  // platform_admin: all capabilities
}

const ROLE_INHERITANCE: Record<string, string> = {
  doctor:           'clinical_officer',
  clinical_officer: 'nurse',
}

function expandRole(role: string): string[] {
  const roles: string[] = [role]
  let current = ROLE_INHERITANCE[role]
  while (current) {
    roles.push(current)
    current = ROLE_INHERITANCE[current]
  }
  return roles
}

/** Fast client-side capability check (no DB round-trip). Does NOT replace requireCapability(). */
export function canDo(
  role:     string,
  module:   string,
  resource: string,
  action:   string,
): boolean {
  if (role === 'platform_admin') return true
  if (role === 'hospital_admin') return module !== 'platform'

  for (const r of expandRole(role)) {
    const grants = DIRECT_GRANTS[r] ?? []
    if (grants.some(([m, res, a]) => m === module && res === resource && a === action)) {
      return true
    }
  }
  return false
}
