// apps/web/src/lib/capability-map.ts
// Static mirror of the role_capabilities DB seed.
// Source of truth is the SQL lattice (has_capability RPC).
// This map is used for documentation and fast client-side guards only.

export type CapTuple = readonly [module: string, resource: string, action: string]

// Direct grants only — role_hierarchy handles inheritance
const DIRECT_GRANTS: Record<string, readonly CapTuple[]> = {
  nurse: [
    ['clinical',     'patient',   'read' ],
    ['clinical',     'encounter', 'read' ],
    ['clinical',     'encounter', 'write'],
    ['longitudinal', 'pattern',   'read' ],
  ],

  clinical_officer: [
    ['clinical',     'patient',      'write'],
    ['clinical',     'prescription', 'read' ],
    ['clinical',     'prescription', 'write'],
    ['insurance',    'preauth',      'read' ],
    ['insurance',    'copilot',      'read' ],
    ['longitudinal', 'context',      'read' ],
  ],

  doctor: [
    ['clinical',     'patient',      'delete'],
    ['clinical',     'encounter',    'delete'],
    ['clinical',     'prescription', 'admin' ],
    ['clinical',     'prescription', 'delete'],
    ['clinical',     'report',       'read'  ],
    ['clinical',     'report',       'write' ],
    ['insurance',    'preauth',      'read'  ],
    ['insurance',    'copilot',      'read'  ],
    ['longitudinal', 'pattern',      'read'  ],
    ['longitudinal', 'context',      'read'  ],
    ['longitudinal', 'outcome',      'write' ],
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
    ['pos',      'sale',         'read' ],
    ['pos',      'sale',         'write'],
    ['pos',      'cart',         'write'],
    ['pos',      'report',       'read' ],
  ],

  pharmacy_store_manager: [
    ['pos', 'refund',  'write'],
    ['pos', 'cashier', 'admin'],
  ],

  lab_tech: [
    ['lab', 'sample', 'read' ],
    ['lab', 'sample', 'write'],
    ['lab', 'result', 'read' ],
    ['lab', 'result', 'write'],
    ['lab', 'result', 'admin'],
  ],

  claims_officer: [
    ['insurance', 'policy',  'read' ],
    ['insurance', 'claim',   'read' ],
    ['insurance', 'claim',   'write'],
    ['insurance', 'preauth', 'read' ],
    ['insurance', 'preauth', 'write'],
    ['insurance', 'copilot', 'read' ],
  ],

  hospital_admin: [
    ['subscription', 'plan',    'read'],
    ['subscription', 'billing', 'read'],
    ['insurance',    'policy',  'read'],
    ['insurance',    'claim',   'read'],
  ],
}

const HOSPITAL_MODULES = new Set([
  'opd', 'ipd', 'lab', 'dispensing', 'ward', 'radiology', 'maternity', 'theatre',
  'emergency', 'immunization', 'registration', 'clinical', 'mortuary', 'billing', 'claims',
])

const ROLE_INHERITANCE: Record<string, string> = {
  doctor:                 'clinical_officer',
  clinical_officer:       'nurse',
  insurance_officer:      'claims_officer',
  pharmacy_store_manager: 'pharmacist',
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
  if (role === 'platform_admin' && !HOSPITAL_MODULES.has(module)) return true
  if (role === 'hospital_admin') {
    const grants = DIRECT_GRANTS['hospital_admin'] ?? []
    if (grants.some(([m, res, a]) => m === module && res === resource && a === action)) return true
    return module !== 'platform' && module !== 'subscription' && module !== 'insurance'
  }

  for (const r of expandRole(role)) {
    const grants = DIRECT_GRANTS[r] ?? []
    if (grants.some(([m, res, a]) => m === module && res === resource && a === action)) {
      return true
    }
  }
  return false
}
