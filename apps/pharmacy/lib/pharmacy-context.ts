import { NextResponse } from "next/server"
import {
  requirePharmacyPermission,
  requirePharmacyTenant,
  type PharmacyApiAuthFailure,
  type PharmacyApiTenantAuth,
} from "@/lib/api-auth"
import { pharmacyDomainError, httpStatusForPharmacyError } from "@synapse/db/errors"
import { isPharmacyAdmin } from "@/lib/auth"

export type PharmacyContext = PharmacyApiTenantAuth & {
  storeId: string | null
}

export async function requirePharmacyContext(): Promise<PharmacyContext | PharmacyApiAuthFailure> {
  const auth = await requirePharmacyTenant()
  if (!auth.ok) return auth
  return { ...auth, storeId: auth.session.storeId ?? null }
}

export async function requireCapability(
  permission: string | string[],
): Promise<PharmacyContext | PharmacyApiAuthFailure> {
  const auth = await requirePharmacyPermission(permission)
  if (!auth.ok) return auth
  return { ...auth, storeId: auth.session.storeId ?? null }
}

/**
 * Store-scoped authorization.
 * - Tenant-wide roles (admin / no assigned store) may access any store in-tenant.
 * - A staff row with storeId may only act on that store (or omit store for tenant-wide reads).
 */
export function requireStoreScope(
  ctx: PharmacyContext,
  requestedStoreId: string | null | undefined,
  options: { required?: boolean } = {},
): { ok: true; storeId: string | null } | PharmacyApiAuthFailure {
  const assigned = ctx.storeId
  const requested = requestedStoreId?.trim() || null

  if (options.required && !requested && !assigned) {
    return domainFail("STORE_SCOPE_DENIED", "Choose a store for this action.")
  }

  if (isPharmacyAdmin(ctx.session) || !assigned) {
    return { ok: true, storeId: requested ?? assigned }
  }

  if (requested && requested !== assigned) {
    return domainFail("STORE_SCOPE_DENIED", "This staff account cannot access that store.")
  }

  return { ok: true, storeId: assigned }
}

function domainFail(code: string, humanMessage: string): PharmacyApiAuthFailure {
  return {
    ok: false,
    response: NextResponse.json(pharmacyDomainError(code, humanMessage), {
      status: httpStatusForPharmacyError(code),
    }),
  }
}

export const __test__ = { requireStoreScope }
