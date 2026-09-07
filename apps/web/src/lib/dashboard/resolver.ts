// Dashboard resolver — returns the appropriate path and context for any user/tenant combination.
// Called once per authenticated page load to determine where to send the user.

export type FacilityType = 'pharmacy' | 'clinic' | 'hospital' | 'homecare' | 'ngo' | 'lab'

export interface DashboardContext {
  userId:    string
  role:      string
  tenantId:  string
  tenantSlug: string
  facilityType: FacilityType | string
  enabledModules: string[]
  subscriptionFeatures: string[]
}

export interface ResolvedDashboard {
  /** Client-side redirect target after login */
  redirectPath: string
  /** Ordered list of primary nav modules shown to this user */
  primaryModules: string[]
  /** Quick actions surfaced on the dashboard home */
  quickActions: string[]
}

// Role → base path (relative to tenant slug)
const ROLE_BASE: Record<string, string> = {
  doctor:                  'clinical',
  clinical_officer:        'clinical',
  nurse:                   'clinical',
  pharmacist:              'pharmacy',
  pharmacy_store_manager:  'pharmacy',
  pharmacy_admin:          'pharmacy',
  pharmacy_staff:          'pharmacy',
  pharmacy_ceo:            'pharmacy',
  lab_tech:                'lab',
  receptionist:            'patients',
  hospital_admin:          'admin',
  claims_officer:          'insurance',
  insurance_officer:       'insurance',
}

// Facility type → available modules (what to show in nav regardless of role)
const FACILITY_MODULES: Record<string, string[]> = {
  pharmacy:  ['pharmacy', 'pos', 'suppliers', 'inventory'],
  clinic:    ['clinical', 'lab', 'pharmacy', 'patients', 'billing'],
  hospital:  ['clinical', 'lab', 'pharmacy', 'patients', 'billing', 'insurance', 'admin'],
  homecare:  ['clinical', 'patients', 'billing'],
  ngo:       ['clinical', 'lab', 'pharmacy', 'patients'],
  lab:       ['lab', 'patients'],
}

// Role → quick actions
const ROLE_QUICK_ACTIONS: Record<string, string[]> = {
  doctor:                  ['new_encounter', 'search_patient', 'view_differential'],
  clinical_officer:        ['new_encounter', 'search_patient'],
  nurse:                   ['new_encounter', 'record_vitals', 'search_patient'],
  pharmacist:              ['new_sale', 'dispense', 'check_stock'],
  pharmacy_store_manager:  ['new_sale', 'cashier_session', 'check_stock', 'view_reports'],
  pharmacy_staff:          ['new_sale', 'check_stock'],
  pharmacy_ceo:            ['new_sale', 'check_stock', 'view_reports'],
  pharmacy_admin:          ['new_sale', 'cashier_session', 'check_stock', 'view_reports'],
  lab_tech:                ['new_sample', 'view_pending', 'enter_results'],
  receptionist:            ['register_patient', 'search_patient', 'book_appointment'],
  hospital_admin:          ['view_reports', 'manage_users', 'view_audit'],
  claims_officer:          ['check_eligibility', 'draft_claim', 'view_preauths'],
  insurance_officer:       ['check_eligibility', 'draft_claim', 'view_preauths', 'view_reports'],
}

export function resolveDashboardForUser(ctx: DashboardContext): ResolvedDashboard {
  const { role, facilityType, tenantSlug, enabledModules, subscriptionFeatures } = ctx

  if (role === 'platform_admin') {
    return {
      redirectPath:   '/platform',
      primaryModules: ['tenants', 'users', 'billing', 'audit', 'system'],
      quickActions:   ['provision_tenant', 'view_audit', 'system_health'],
    }
  }

  if (facilityType === 'laboratory') {
    return { redirectPath: '/lab/orders', primaryModules: ['core', 'registration', 'lab', 'billing', 'reports'].filter(key => enabledModules.includes(key)), quickActions: ['view_pending', 'enter_results'] }
  }

  const roleBase   = ROLE_BASE[role] ?? 'dashboard'
  const facilityMods  = FACILITY_MODULES[facilityType] ?? ['clinical']
  const allFeatures   = new Set([...enabledModules, ...subscriptionFeatures])

  // Filter modules to only those enabled by subscription or module list
  const primaryModules = facilityMods.filter(m => {
    if (m === 'pos' || m === 'suppliers') return allFeatures.has('pos') || allFeatures.has(m)
    if (m === 'insurance')  return allFeatures.has('insurance_copilot')
    return true
  })

  const quickActions = ROLE_QUICK_ACTIONS[role] ?? []

  return {
    redirectPath:   `/os/${tenantSlug}/${roleBase}`,
    primaryModules,
    quickActions,
  }
}
