/**
 * Mortuary custody: identification, property, storage, and authorized release.
 * Every transition is auditable. Custody must not silently duplicate.
 */

export const MORTUARY_STATUSES = [
  "pronounced",
  "identified",
  "tagged",
  "property_recorded",
  "transport_requested",
  "received",
  "stored",
  "release_authorized",
  "released",
] as const
export type MortuaryStatus = (typeof MORTUARY_STATUSES)[number]

/** Release destinations belong exclusively to the dedicated release APIs. */
export const PROTECTED_MORTUARY_RELEASE_STATUSES = ["release_authorized", "released"] as const
export type ProtectedMortuaryReleaseStatus = (typeof PROTECTED_MORTUARY_RELEASE_STATUSES)[number]

export function isProtectedMortuaryReleaseStatus(status: string): status is ProtectedMortuaryReleaseStatus {
  return status === "release_authorized" || status === "released"
}

export function assertGenericCustodyDestination(to: MortuaryStatus): void {
  if (isProtectedMortuaryReleaseStatus(to)) {
    throw new Error("MORTUARY_RELEASE_REQUIRES_AUTHORIZED_WORKFLOW")
  }
}

export const MORTUARY_CAPABILITIES = {
  registerRead: { module: "mortuary", resource: "register", action: "read" },
  registerWrite: { module: "mortuary", resource: "register", action: "write" },
  custodyWrite: { module: "mortuary", resource: "custody", action: "write" },
  propertyWrite: { module: "mortuary", resource: "property", action: "write" },
  releaseApprove: { module: "mortuary", resource: "release", action: "approve" },
  configWrite: { module: "mortuary", resource: "config", action: "write" },
} as const

const ALLOWED: Record<MortuaryStatus, MortuaryStatus[]> = {
  pronounced: ["identified"],
  identified: ["tagged"],
  tagged: ["property_recorded"],
  property_recorded: ["transport_requested"],
  transport_requested: ["received"],
  received: ["stored"],
  stored: ["release_authorized", "stored"],
  release_authorized: ["released"],
  released: [],
}

export type MortuaryIdentity = {
  patientId?: string | null
  personId?: string | null
  synapseId?: string | null
  bodyNumber: string
  tagCode: string
  unknownPerson: boolean
  temporaryIdentity?: string | null
  reconciledPersonId?: string | null
}

export type MortuaryPropertyItem = {
  id: string
  item: string
  description?: string | null
  quantity: number
  sealedBagReference?: string | null
  recordedBy: string
  witness?: string | null
  handoverRecipient?: string | null
  handoverAt?: string | null
}

export type MortuaryStorage = {
  mortuaryId: string
  room?: string | null
  section?: string | null
  slotCode: string
  admittedAt?: string | null
  movedAt?: string | null
  releasedAt?: string | null
}

export type MortuaryRelease = {
  authorized: boolean
  authorizedBy?: string | null
  authorizedAt?: string | null
  recipientName?: string | null
  recipientIdentity?: string | null
  relationshipOrAuthority?: string | null
  staffId?: string | null
  releasedAt?: string | null
  supportingDocumentId?: string | null
}

export type MortuaryBody = {
  id: string
  tenantId: string
  facilityId: string
  pronouncementId: string
  encounterId?: string | null
  status: MortuaryStatus
  identity: MortuaryIdentity
  storage?: MortuaryStorage | null
  property: MortuaryPropertyItem[]
  release: MortuaryRelease
  propertyDocumentId?: string | null
  transferDocumentId?: string | null
  releaseDocumentId?: string | null
  isSynthetic: boolean
  createdAt: string
  updatedAt: string
  audit: Array<{ at: string; actorId: string; action: string; from?: string; to?: string; detail?: string }>
}

export function canTransitionMortuary(from: MortuaryStatus, to: MortuaryStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export function assertSameMortuaryTenant(record: { tenantId: string }, sessionTenantId: string): void {
  if (record.tenantId !== sessionTenantId) throw new Error("MORTUARY_TENANT_MISMATCH")
}

export function createMortuaryBody(input: {
  id?: string
  tenantId: string
  facilityId: string
  pronouncementId: string
  encounterId?: string | null
  identity: Omit<MortuaryIdentity, "bodyNumber" | "tagCode"> & { bodyNumber?: string; tagCode?: string }
  actorId: string
  isSynthetic?: boolean
}): MortuaryBody {
  if (!input.tenantId || !input.facilityId) throw new Error("MORTUARY_TENANT_FACILITY_REQUIRED")
  if (!input.pronouncementId) throw new Error("MORTUARY_PRONOUNCEMENT_REQUIRED")
  const now = new Date().toISOString()
  const bodyNumber = input.identity.bodyNumber?.trim() || `MB-${now.slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const tagCode = input.identity.tagCode?.trim() || `TAG-${bodyNumber}`
  if (!input.identity.unknownPerson && !input.identity.patientId && !input.identity.personId && !input.identity.synapseId) {
    throw new Error("MORTUARY_IDENTITY_REQUIRED")
  }
  if (input.identity.unknownPerson && !input.identity.temporaryIdentity?.trim()) {
    throw new Error("MORTUARY_TEMPORARY_IDENTITY_REQUIRED")
  }
  return {
    id: input.id ?? crypto.randomUUID(),
    tenantId: input.tenantId,
    facilityId: input.facilityId,
    pronouncementId: input.pronouncementId,
    encounterId: input.encounterId ?? null,
    status: "pronounced",
    identity: {
      patientId: input.identity.patientId ?? null,
      personId: input.identity.personId ?? null,
      synapseId: input.identity.synapseId ?? null,
      bodyNumber,
      tagCode,
      unknownPerson: Boolean(input.identity.unknownPerson),
      temporaryIdentity: input.identity.temporaryIdentity ?? null,
      reconciledPersonId: input.identity.reconciledPersonId ?? null,
    },
    storage: null,
    property: [],
    release: { authorized: false },
    isSynthetic: input.isSynthetic ?? false,
    createdAt: now,
    updatedAt: now,
    audit: [{ at: now, actorId: input.actorId, action: "admitted", to: "pronounced" }],
  }
}

export function transitionMortuaryBody(
  body: MortuaryBody,
  input: { to: MortuaryStatus; actorId: string; detail?: string; at?: string },
): MortuaryBody {
  if (body.status === input.to && input.to !== "stored") {
    throw new Error("MORTUARY_TRANSITION_DUPLICATE")
  }
  if (!canTransitionMortuary(body.status, input.to)) throw new Error("MORTUARY_INVALID_TRANSITION")
  const at = input.at ?? new Date().toISOString()
  return {
    ...body,
    status: input.to,
    updatedAt: at,
    audit: [...body.audit, { at, actorId: input.actorId, action: "transition", from: body.status, to: input.to, detail: input.detail }],
  }
}

export function assignMortuaryStorage(
  body: MortuaryBody,
  input: {
    storage: MortuaryStorage
    occupiedSlotIds: string[]
    actorId: string
  },
): MortuaryBody {
  const slotKey = `${input.storage.mortuaryId}:${input.storage.slotCode}`
  if (input.occupiedSlotIds.includes(slotKey)) throw new Error("MORTUARY_SLOT_OCCUPIED")
  const at = new Date().toISOString()
  const next = body.status === "received" ? transitionMortuaryBody(body, { to: "stored", actorId: input.actorId, detail: slotKey, at }) : body
  return {
    ...next,
    storage: {
      ...input.storage,
      admittedAt: input.storage.admittedAt ?? at,
      movedAt: body.storage ? at : null,
    },
    updatedAt: at,
    audit: [...next.audit, { at, actorId: input.actorId, action: "storage_assigned", detail: slotKey }],
  }
}

export function recordMortuaryProperty(
  body: MortuaryBody,
  input: { items: Array<Omit<MortuaryPropertyItem, "id"> & { id?: string }>; actorId: string },
): MortuaryBody {
  if (!input.items.length) throw new Error("MORTUARY_PROPERTY_REQUIRED")
  const at = new Date().toISOString()
  const property = input.items.map((item) => {
    if (!item.item.trim() || item.quantity < 1) throw new Error("MORTUARY_PROPERTY_INVALID")
    return {
      id: item.id ?? crypto.randomUUID(),
      item: item.item.trim(),
      description: item.description ?? null,
      quantity: item.quantity,
      sealedBagReference: item.sealedBagReference ?? null,
      recordedBy: item.recordedBy || input.actorId,
      witness: item.witness ?? null,
      handoverRecipient: item.handoverRecipient ?? null,
      handoverAt: item.handoverAt ?? null,
    }
  })
  const next = body.status === "tagged" ? transitionMortuaryBody(body, { to: "property_recorded", actorId: input.actorId, at }) : body
  return {
    ...next,
    property,
    updatedAt: at,
    audit: [...next.audit, { at, actorId: input.actorId, action: "property_recorded" }],
  }
}

export function authorizeMortuaryRelease(
  body: MortuaryBody,
  input: {
    hasReleaseCapability: boolean
    authorizedBy: string
    recipientName: string
    recipientIdentity: string
    relationshipOrAuthority: string
    supportingDocumentId?: string | null
  },
): MortuaryBody {
  if (!input.hasReleaseCapability) throw new Error("MORTUARY_RELEASE_FORBIDDEN")
  if (body.status !== "stored") throw new Error("MORTUARY_RELEASE_REQUIRES_STORAGE")
  if (!input.recipientName.trim() || !input.recipientIdentity.trim() || !input.relationshipOrAuthority.trim()) {
    throw new Error("MORTUARY_RELEASE_RECIPIENT_REQUIRED")
  }
  const next = transitionMortuaryBody(body, { to: "release_authorized", actorId: input.authorizedBy })
  const at = next.updatedAt
  return {
    ...next,
    release: {
      authorized: true,
      authorizedBy: input.authorizedBy,
      authorizedAt: at,
      recipientName: input.recipientName.trim(),
      recipientIdentity: input.recipientIdentity.trim(),
      relationshipOrAuthority: input.relationshipOrAuthority.trim(),
      supportingDocumentId: input.supportingDocumentId ?? null,
    },
  }
}

export function releaseMortuaryBody(
  body: MortuaryBody,
  input: { staffId: string; hasReleaseCapability: boolean; at?: string },
): MortuaryBody {
  if (!input.hasReleaseCapability) throw new Error("MORTUARY_RELEASE_FORBIDDEN")
  if (!body.release.authorized) throw new Error("MORTUARY_RELEASE_NOT_AUTHORIZED")
  const next = transitionMortuaryBody(body, { to: "released", actorId: input.staffId, at: input.at })
  return {
    ...next,
    release: {
      ...body.release,
      staffId: input.staffId,
      releasedAt: next.updatedAt,
    },
    storage: body.storage ? { ...body.storage, releasedAt: next.updatedAt } : null,
  }
}

export function reconcileUnknownIdentity(
  body: MortuaryBody,
  input: { personId: string; patientId?: string | null; synapseId?: string | null; actorId: string },
): MortuaryBody {
  if (!body.identity.unknownPerson) throw new Error("MORTUARY_NOT_UNKNOWN")
  const at = new Date().toISOString()
  return {
    ...body,
    identity: {
      ...body.identity,
      reconciledPersonId: input.personId,
      personId: input.personId,
      patientId: input.patientId ?? body.identity.patientId,
      synapseId: input.synapseId ?? body.identity.synapseId,
      unknownPerson: false,
    },
    updatedAt: at,
    audit: [...body.audit, { at, actorId: input.actorId, action: "identity_reconciled", detail: input.personId }],
  }
}

export function mortuaryPublicTag(body: MortuaryBody): { bodyNumber: string; tagCode: string } {
  return { bodyNumber: body.identity.bodyNumber, tagCode: body.identity.tagCode }
}

export function applyMortuaryTransitionCommand(params: {
  body: MortuaryBody
  commandId: string
  appliedCommandIds: string[]
  to: MortuaryStatus
  actorId: string
}): MortuaryBody {
  assertGenericCustodyDestination(params.to)
  if (params.appliedCommandIds.includes(params.commandId)) return params.body
  return transitionMortuaryBody(params.body, { to: params.to, actorId: params.actorId, detail: params.commandId })
}

export function mortuaryBodyToRow(body: MortuaryBody): Record<string, unknown> {
  return {
    id: body.id,
    tenant_id: body.tenantId,
    facility_id: body.facilityId,
    pronouncement_id: body.pronouncementId,
    encounter_id: body.encounterId ?? null,
    status: body.status,
    identity: body.identity,
    storage: body.storage,
    property: body.property,
    release: body.release,
    property_document_id: body.propertyDocumentId ?? null,
    transfer_document_id: body.transferDocumentId ?? null,
    release_document_id: body.releaseDocumentId ?? null,
    is_synthetic: body.isSynthetic,
    created_at: body.createdAt,
    updated_at: body.updatedAt,
    audit: body.audit,
  }
}

export function mortuaryBodyFromRow(row: Record<string, unknown>): MortuaryBody {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    facilityId: String(row.facility_id),
    pronouncementId: String(row.pronouncement_id),
    encounterId: row.encounter_id ? String(row.encounter_id) : null,
    status: row.status as MortuaryStatus,
    identity: row.identity as MortuaryIdentity,
    storage: (row.storage as MortuaryStorage | null) ?? null,
    property: Array.isArray(row.property) ? (row.property as MortuaryPropertyItem[]) : [],
    release: (row.release as MortuaryRelease) ?? { authorized: false },
    propertyDocumentId: row.property_document_id ? String(row.property_document_id) : null,
    transferDocumentId: row.transfer_document_id ? String(row.transfer_document_id) : null,
    releaseDocumentId: row.release_document_id ? String(row.release_document_id) : null,
    isSynthetic: Boolean(row.is_synthetic),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    audit: Array.isArray(row.audit) ? (row.audit as MortuaryBody["audit"]) : [],
  }
}
