/**
 * Identity crosswalk: one canonical person, many aliases.
 * Never treats an external identifier as the primary key.
 * Never auto-merges.
 */

import type { ExternalIdentifier, IdentifierType } from "./identity"
import { identifierNamespaceKey, localMrnIdentifier } from "./identity"
import { shouldAutoMerge, type IdentityMatch } from "./mpi"

export type IdentityAlias = ExternalIdentifier & {
  personId: string
  verified: boolean
}

export type IdentityCrosswalk = {
  personId: string
  synapseId: string
  aliases: IdentityAlias[]
}

export function addAlias(crosswalk: IdentityCrosswalk, alias: ExternalIdentifier, verified = false): IdentityCrosswalk {
  const next: IdentityAlias = { ...alias, personId: crosswalk.personId, verified }
  const exists = crosswalk.aliases.some((item) => identifierNamespaceKey(item) === identifierNamespaceKey(next))
  if (exists) return crosswalk
  return { ...crosswalk, aliases: [...crosswalk.aliases, next] }
}

export function aliasesForType(crosswalk: IdentityCrosswalk, type: IdentifierType): IdentityAlias[] {
  return crosswalk.aliases.filter((item) => item.type === type)
}

export function facilityMrn(crosswalk: IdentityCrosswalk, facilityId: string): string | null {
  const match = crosswalk.aliases.find(
    (item) => item.type === "MRN" && item.issuingFacilityId === facilityId,
  )
  return match?.value ?? null
}

export function attachFacilityMrn(
  crosswalk: IdentityCrosswalk,
  params: { mrn: string; facilityId: string; organizationId?: string | null },
): IdentityCrosswalk {
  return addAlias(crosswalk, localMrnIdentifier(params), true)
}

export function rejectUnsafeMerge(match: IdentityMatch): void {
  if (shouldAutoMerge(match)) {
    throw new Error("UNSAFE_AUTO_MERGE_FORBIDDEN")
  }
}

export function createCrosswalk(personId: string, synapseId: string, aliases: ExternalIdentifier[] = []): IdentityCrosswalk {
  return {
    personId,
    synapseId,
    aliases: aliases.map((alias) => ({ ...alias, personId, verified: alias.type === "SYNAPSE_ID" })),
  }
}
