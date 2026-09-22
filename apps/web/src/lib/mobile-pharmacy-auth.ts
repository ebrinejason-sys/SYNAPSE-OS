import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession, roleHasCapability, type PharmacyCapability } from '@synapse/auth'

const PHARMACY_ROLES = new Set([
  'pharmacist',
  'pharmacy_admin',
  'pharmacy_store_manager',
  'pharmacy_cashier',
  'cashier',
  'pharmacy_staff',
  'pharmacy_ceo',
  'inventory_officer',
])

export type MobileAuth = {
  userId: string
  tenantId: string
  role: string
  token: string
}

const ADMIN_ROLES = new Set(['pharmacy_admin', 'pharmacy_ceo', 'pharmacist'])

export function isMobilePharmacyAdmin(auth: MobileAuth): boolean {
  return ADMIN_ROLES.has(auth.role) || roleHasCapability(auth.role, 'settings.manage')
}

export function mobileHasPharmacyCapability(auth: MobileAuth, capability: PharmacyCapability): boolean {
  return roleHasCapability(auth.role, capability)
}

export function canWriteMobilePharmacyInventory(auth: MobileAuth): boolean {
  return roleHasCapability(auth.role, 'inventory.adjust') || roleHasCapability(auth.role, 'inventory.write')
}

export async function requireMobilePharmacyAuth(
  req: NextRequest,
): Promise<MobileAuth | NextResponse> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const role = String(payload.role ?? '')
  if (!PHARMACY_ROLES.has(role)) {
    return NextResponse.json({ error: 'Pharmacy role required' }, { status: 403 })
  }

  const tenantId = String(payload.tenant_id ?? '')
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 })
  }

  return {
    userId: payload.sub as string,
    tenantId,
    role,
    token,
  }
}

export function isMobileAuth(value: MobileAuth | NextResponse): value is MobileAuth {
  return !(value instanceof NextResponse) && 'userId' in value
}
