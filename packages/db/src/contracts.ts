/**
 * Core contract barrel. Feature agents import from here instead of inventing
 * parallel Person / Facility / Sync / Audit types.
 */

export type {
  PersonDemographics,
  ExternalIdentifier,
  IdentifierType,
  ProvenanceSource,
} from "./identity"
export {
  generateSynapseId,
  isValidSynapseId,
  identifiersAreSameNamespace,
  buildPersonRegistration,
} from "./identity"

export type {
  ScopeAssignment,
  ResourceScope,
  ScopeSession,
  FacilityRecord,
  FacilityMode,
  FacilityContext,
} from "./scope"
export { canAccessResource, assertSiteAllowed } from "./scope"

export type { ConsentRecord, ConsentPurpose } from "./consent"
export { hasPurposeConsent } from "./consent"

export type { TimelineEventInput } from "./timeline"
export { assertTimelineSubject, pharmacyDispenseTimelineEvent } from "./timeline"

export type { DomainEventEnvelope } from "./exchange"
export { ExchangeOutbox } from "./exchange"
export { LabWorkflow } from "./lab-workflow"
export { PathwayRuntime, SEPSIS_PATHWAY } from "./pathways"
export { SimulationEngine, assertDemoResetAllowed } from "./simulation"

export type {
  SyncCommand,
  SyncEnvelope,
  SyncConflict,
  PersonIdentity,
  AuditEvent,
} from "./sync-contract"
export {
  SYNC_SCHEMA_VERSION,
  SYNC_COMMAND_TYPES,
  assertSyncCommand,
  canonicalizePayload,
  hashPayload,
  resolveSyncConflict,
  toSyncOutboxRow,
  conflictPolicyFor,
  payloadHashesMatch,
} from "./sync-contract"

export type { PharmacyDomainError, PharmacyErrorCode } from "./errors"
export {
  PHARMACY_ERROR_CODES,
  pharmacyDomainError,
  httpStatusForPharmacyError,
} from "./errors"
