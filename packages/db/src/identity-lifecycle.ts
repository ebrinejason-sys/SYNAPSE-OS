/**
 * Identity lifecycle is distinct from facility membership.
 * Removing a membership must not erase the global identity.
 * Deleting or deactivating an account must not erase historical authorship.
 */

export type IdentityLifecycleAction =
  | "activate"
  | "deactivate"
  | "suspend"
  | "reactivate"
  | "archive"
  | "restore"
  | "revoke_sessions"
  | "remove_membership"
  | "purge"

const PLATFORM_ROLES = new Set(["platform_admin", "superadmin"])

export type IdentityLifecyclePreview = {
  userId: string
  action: IdentityLifecycleAction
  allowed: boolean
  identityPreserved: boolean
  authorshipPreserved: boolean
  blockers: string[]
}

export function previewIdentityLifecycle(params: {
  userId: string
  action: IdentityLifecycleAction
  role?: string | null
  isDeleted?: boolean
  verificationStatus?: string | null
  activePlatformAdminCount?: number
  authoredRecords?: number
  soleFacilityOwner?: boolean
  typedConfirmation?: string | null
  email?: string | null
}): IdentityLifecyclePreview {
  const blockers: string[] = []
  const role = String(params.role ?? "")
  const isPlatform = PLATFORM_ROLES.has(role)
  const platformCount = params.activePlatformAdminCount ?? 0
  const authored = params.authoredRecords ?? 0
  const status = String(params.verificationStatus ?? "").toLowerCase()
  const lastPlatformAdmin = isPlatform && platformCount <= 1

  if (lastPlatformAdmin && ["deactivate", "suspend", "archive", "purge"].includes(params.action)) {
    blockers.push("Cannot remove the last Platform Admin until another valid Platform Admin exists")
  }

  if (params.soleFacilityOwner && (params.action === "remove_membership" || params.action === "purge")) {
    blockers.push("Reassign the sole facility owner or admin before removing this membership")
  }

  if (params.action === "activate" && params.isDeleted) {
    blockers.push("Archived identities must be restored before activation")
  }

  if (params.action === "reactivate" && params.isDeleted) {
    blockers.push("Restore the archived identity before reactivation")
  }

  if (params.action === "restore" && !params.isDeleted && status !== "suspended" && status !== "disabled") {
    blockers.push("Identity is not archived or suspended")
  }

  if (params.action === "purge") {
    if (authored > 0) {
      blockers.push("Historical authorship must survive. Archive the identity instead of deleting it.")
    }
    const typed = String(params.typedConfirmation ?? "").trim().toLowerCase()
    const email = String(params.email ?? "").trim().toLowerCase()
    if (!typed || typed !== email || !email) {
      blockers.push("Type the account email exactly to confirm permanent identity deletion")
    }
  }

  const identityPreserved = params.action !== "purge"
  const authorshipPreserved = params.action !== "purge" || authored === 0

  return {
    userId: params.userId,
    action: params.action,
    allowed: blockers.length === 0,
    identityPreserved,
    authorshipPreserved,
    blockers,
  }
}
