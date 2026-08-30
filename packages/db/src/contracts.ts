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
export { assertTimelineSubject, pharmacyDispenseTimelineEvent, labResultToTimelineEvent } from "./timeline"

export type { DomainEventEnvelope } from "./exchange"
export { ExchangeOutbox } from "./exchange"
export {
  LabWorkflow,
  runMalariaLabSlice,
  MALARIA_PF_ANTIGEN_LOINC,
  MALARIA_LAB_SLICE_EVENTS,
} from "./lab-workflow"
export { PathwayRuntime, SEPSIS_PATHWAY } from "./pathways"
export { SimulationEngine, assertDemoResetAllowed } from "./simulation"
export { WorkQueue, routeClinicalOrder, TASK_STATUSES, TASK_TYPES } from "./work-queue"
export type { DepartmentTask, CreateTaskInput, TaskStatus, TaskType, TaskPriority } from "./work-queue"
export {
  seedHospital,
  resetHospital,
  reseedHospital,
  inspectHospital,
  getHospitalSeed,
  getHospitalWorkQueue,
  HOSPITAL_CANONICAL_SLUG,
  HOSPITAL_CANONICAL_SEED,
  HOSPITAL_CANONICAL_NAME,
  HOSPITAL_DEPARTMENTS,
  HOSPITAL_LOCATIONS,
  HOSPITAL_STAFF_ROLES,
  HOSPITAL_TEST_PATIENTS,
} from "./hospital-seed"

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
