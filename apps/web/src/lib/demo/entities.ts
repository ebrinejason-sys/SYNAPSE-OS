/**
 * SYNAPSE Demo Playground - Typed Entity Interfaces
 * All entities for the local synthetic demo database
 */

// ============================================
// CORE FACILITY & USER ENTITIES
// ============================================

export interface DemoFacility {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'laboratory' | 'pharmacy';
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoUser {
  id: string;
  facilityId: string;
  role: 'reception' | 'nurse' | 'doctor' | 'lab_technician' | 'lab_scientist' | 'pharmacist' | 'cashier' | 'admin';
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PERSON & IDENTITY ENTITIES
// ============================================

export interface DemoPerson {
  id: string;
  synapseId: string; // SYN-UG-DEMO-0001
  name: string;
  dateOfBirth: string;
  sex: 'male' | 'female' | 'unknown';
  phone?: string;
  address?: string;
  synthetic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DemoIdentifier {
  id: string;
  personId: string;
  facilityId: string;
  identifierType: 'mrn' | 'national_id' | 'passport' | 'other' | 'synapse_id';
  value: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// ENCOUNTER & QUEUE ENTITIES
// ============================================

export interface DemoEncounter {
  id: string;
  personId: string;
  facilityId: string;
  encounterType: 'opd' | 'ipd' | 'emergency' | 'follow_up';
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  visitType: 'consultation' | 'procedure' | 'admission' | 'referral';
  complaint?: string;
  paymentCategory: 'cash' | 'insurance' | 'government' | 'waiver';
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoQueueItem {
  id: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  queueType: 'reception' | 'triage' | 'doctor' | 'lab' | 'pharmacy' | 'billing';
  priority: 'routine' | 'urgent' | 'emergency';
  status: 'waiting' | 'in_progress' | 'completed' | 'skipped';
  position: number;
  assignedTo?: string; // userId
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CLINICAL ENTITIES
// ============================================

export interface DemoTriage {
  id: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  recordedBy: string; // userId
  temperatureC?: number;
  heartRate?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  respiratoryRate?: number;
  spo2?: number;
  weightKg?: number;
  heightCm?: number;
  painScore?: number;
  triageCategory: 'red' | 'orange' | 'yellow' | 'green';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoObservation {
  id: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  recordedBy: string;
  code: string; // LOINC or local code
  display: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  interpretation?: 'normal' | 'high' | 'low' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface DemoClinicalNote {
  id: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  authorId: string; // doctor userId
  status: 'draft' | 'signed' | 'amended';
  chiefComplaint?: string;
  hpi?: string; // History of Present Illness
  pmh?: string; // Past Medical History
  psh?: string; // Past Surgical History
  medications?: string;
  allergies?: string;
  familyHistory?: string;
  socialHistory?: string;
  ros?: string; // Review of Systems
  generalExam?: string;
  systemicExam?: string;
  assessment?: string;
  differentials?: Array<{ condition: string; icd11Code?: string; confidence: 'high' | 'medium' | 'low' }>;
  plan?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoOrder {
  id: string;
  encounterId: string;
  personId: string;
  sourceFacilityId: string;
  destinationFacilityId: string;
  orderedBy: string; // doctor userId
  orderType: 'lab' | 'imaging' | 'referral' | 'medication';
  testCode: string;
  testName: string;
  loincCode?: string;
  priority: 'routine' | 'urgent' | 'stat';
  clinicalQuestion?: string;
  notes?: string;
  status: 'ordered' | 'acknowledged' | 'collected' | 'processing' | 'verified' | 'released' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface DemoSpecimen {
  id: string;
  orderId: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  specimenType: string;
  collectedBy: string;
  collectedAt: string;
  accessionNumber: string;
  status: 'collected' | 'received' | 'processing' | 'rejected' | 'recollect';
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoLabResult {
  id: string;
  orderId: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  testCode: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  interpretation?: 'normal' | 'high' | 'low' | 'critical';
  enteredBy: string;
  verifiedBy?: string;
  verifiedAt?: string;
  releasedBy?: string;
  releasedAt?: string;
  status: 'entered' | 'verified' | 'released' | 'amended';
  createdAt: string;
  updatedAt: string;
}

export interface DemoDiagnosis {
  id: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  diagnosedBy: string; // doctor userId
  condition: string;
  icd11Code: string;
  icd11Title: string;
  type: 'primary' | 'secondary' | 'differential' | 'rule_out';
  certainty: 'confirmed' | 'probable' | 'possible' | 'ruled_out';
  createdAt: string;
  updatedAt: string;
}

export interface DemoPrescription {
  id: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  prescribedBy: string; // doctor userId
  medicationId: string;
  medicationName: string;
  strength: string;
  form: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
  status: 'active' | 'dispensed' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PHARMACY & INVENTORY ENTITIES
// ============================================

export interface DemoInventoryItem {
  id: string;
  facilityId: string;
  name: string;
  genericName: string;
  strength: string;
  form: string;
  unit: string;
  category: string;
  requiresPrescription: boolean;
  standardPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface DemoBatch {
  id: string;
  inventoryItemId: string;
  facilityId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  costPrice: number;
  salePrice: number;
  supplierId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoDispense {
  id: string;
  prescriptionId: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  dispensedBy: string; // pharmacist userId
  batchId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  dispensedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// BILLING ENTITIES
// ============================================

export interface DemoInvoice {
  id: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  invoiceNumber: string;
  status: 'draft' | 'issued' | 'paid' | 'cancelled' | 'refunded';
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface DemoInvoiceItem {
  id: string;
  invoiceId: string;
  encounterId: string;
  itemType: 'consultation' | 'lab' | 'medication' | 'procedure' | 'other';
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  referenceId?: string; // orderId, prescriptionId, etc.
  createdAt: string;
  updatedAt: string;
}

export interface DemoPayment {
  id: string;
  invoiceId: string;
  encounterId: string;
  personId: string;
  facilityId: string;
  amount: number;
  method: 'cash' | 'mobile_money' | 'card' | 'bank_transfer' | 'insurance' | 'government';
  reference?: string;
  receivedBy: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// REFERRAL & TIMELINE ENTITIES
// ============================================

export interface DemoReferral {
  id: string;
  encounterId: string;
  personId: string;
  fromFacilityId: string;
  toFacilityId: string;
  referredBy: string;
  reason: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface DemoTimelineEvent {
  id: string;
  personId: string;
  encounterId?: string;
  facilityId: string;
  actorId: string;
  eventType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DemoExchangeEvent {
  id: string;
  type: string;
  personId: string;
  encounterId?: string;
  sourceFacilityId: string;
  destinationFacilityId: string;
  actorId: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'acknowledged' | 'failed';
  createdAt: string;
}

export interface DemoNotification {
  id: string;
  userId: string;
  facilityId: string;
  type: 'queue' | 'result' | 'order' | 'alert' | 'system';
  title: string;
  message: string;
  read: boolean;
  relatedEntityId?: string;
  relatedEntityType?: string;
  createdAt: string;
}

export interface DemoAuditEvent {
  id: string;
  actorId: string;
  actorRole: string;
  facilityId: string;
  action: string;
  entityType: string;
  entityId: string;
  personId?: string;
  encounterId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DemoSyncItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// TYPE UNIONS & CONSTANTS
// ============================================

export type DemoEntity =
  | DemoFacility
  | DemoUser
  | DemoPerson
  | DemoIdentifier
  | DemoEncounter
  | DemoQueueItem
  | DemoTriage
  | DemoObservation
  | DemoClinicalNote
  | DemoOrder
  | DemoSpecimen
  | DemoLabResult
  | DemoDiagnosis
  | DemoPrescription
  | DemoInventoryItem
  | DemoBatch
  | DemoDispense
  | DemoInvoice
  | DemoInvoiceItem
  | DemoPayment
  | DemoReferral
  | DemoTimelineEvent
  | DemoExchangeEvent
  | DemoNotification
  | DemoAuditEvent
  | DemoSyncItem;

export const DEMO_STORE_NAMES = [
  'facilities',
  'users',
  'persons',
  'identifiers',
  'encounters',
  'queueItems',
  'triage',
  'observations',
  'clinicalNotes',
  'orders',
  'specimens',
  'labResults',
  'diagnoses',
  'prescriptions',
  'inventoryItems',
  'batches',
  'dispenses',
  'invoices',
  'invoiceItems',
  'payments',
  'referrals',
  'timelineEvents',
  'exchangeEvents',
  'notifications',
  'auditEvents',
  'syncItems',
] as const;

export type DemoStoreName = typeof DEMO_STORE_NAMES[number];

// ============================================
// RBAC PERMISSIONS
// ============================================

export type DemoRole = DemoUser['role'];

export interface DemoPermissions {
  canRegisterPatient: boolean;
  canStartEncounter: boolean;
  canRecordTriage: boolean;
  canSendToDoctor: boolean;
  canWriteClinicalNote: boolean;
  canSignClinicalNote: boolean;
  canOrderLab: boolean;
  canCollectSpecimen: boolean;
  canEnterLabResult: boolean;
  canVerifyLabResult: boolean;
  canReleaseLabResult: boolean;
  canPrescribe: boolean;
  canDispense: boolean;
  canBill: boolean;
  canViewTimeline: boolean;
  canResetPlayground: boolean;
}

export const ROLE_PERMISSIONS: Record<DemoRole, DemoPermissions> = {
  reception: {
    canRegisterPatient: true,
    canStartEncounter: true,
    canRecordTriage: false,
    canSendToDoctor: false,
    canWriteClinicalNote: false,
    canSignClinicalNote: false,
    canOrderLab: false,
    canCollectSpecimen: false,
    canEnterLabResult: false,
    canVerifyLabResult: false,
    canReleaseLabResult: false,
    canPrescribe: false,
    canDispense: false,
    canBill: true,
    canViewTimeline: true,
    canResetPlayground: true,
  },
  nurse: {
    canRegisterPatient: false,
    canStartEncounter: false,
    canRecordTriage: true,
    canSendToDoctor: true,
    canWriteClinicalNote: false,
    canSignClinicalNote: false,
    canOrderLab: false,
    canCollectSpecimen: false,
    canEnterLabResult: false,
    canVerifyLabResult: false,
    canReleaseLabResult: false,
    canPrescribe: false,
    canDispense: false,
    canBill: false,
    canViewTimeline: true,
    canResetPlayground: true,
  },
  doctor: {
    canRegisterPatient: false,
    canStartEncounter: false,
    canRecordTriage: false,
    canSendToDoctor: false,
    canWriteClinicalNote: true,
    canSignClinicalNote: true,
    canOrderLab: true,
    canCollectSpecimen: false,
    canEnterLabResult: false,
    canVerifyLabResult: false,
    canReleaseLabResult: false,
    canPrescribe: true,
    canDispense: false,
    canBill: false,
    canViewTimeline: true,
    canResetPlayground: true,
  },
  lab_technician: {
    canRegisterPatient: false,
    canStartEncounter: false,
    canRecordTriage: false,
    canSendToDoctor: false,
    canWriteClinicalNote: false,
    canSignClinicalNote: false,
    canOrderLab: false,
    canCollectSpecimen: true,
    canEnterLabResult: true,
    canVerifyLabResult: false,
    canReleaseLabResult: false,
    canPrescribe: false,
    canDispense: false,
    canBill: false,
    canViewTimeline: true,
    canResetPlayground: true,
  },
  lab_scientist: {
    canRegisterPatient: false,
    canStartEncounter: false,
    canRecordTriage: false,
    canSendToDoctor: false,
    canWriteClinicalNote: false,
    canSignClinicalNote: false,
    canOrderLab: false,
    canCollectSpecimen: false,
    canEnterLabResult: false,
    canVerifyLabResult: true,
    canReleaseLabResult: true,
    canPrescribe: false,
    canDispense: false,
    canBill: false,
    canViewTimeline: true,
    canResetPlayground: true,
  },
  pharmacist: {
    canRegisterPatient: false,
    canStartEncounter: false,
    canRecordTriage: false,
    canSendToDoctor: false,
    canWriteClinicalNote: false,
    canSignClinicalNote: false,
    canOrderLab: false,
    canCollectSpecimen: false,
    canEnterLabResult: false,
    canVerifyLabResult: false,
    canReleaseLabResult: false,
    canPrescribe: false,
    canDispense: true,
    canBill: false,
    canViewTimeline: true,
    canResetPlayground: true,
  },
  cashier: {
    canRegisterPatient: false,
    canStartEncounter: false,
    canRecordTriage: false,
    canSendToDoctor: false,
    canWriteClinicalNote: false,
    canSignClinicalNote: false,
    canOrderLab: false,
    canCollectSpecimen: false,
    canEnterLabResult: false,
    canVerifyLabResult: false,
    canReleaseLabResult: false,
    canPrescribe: false,
    canDispense: false,
    canBill: true,
    canViewTimeline: true,
    canResetPlayground: true,
  },
  admin: {
    canRegisterPatient: true,
    canStartEncounter: true,
    canRecordTriage: true,
    canSendToDoctor: true,
    canWriteClinicalNote: true,
    canSignClinicalNote: true,
    canOrderLab: true,
    canCollectSpecimen: true,
    canEnterLabResult: true,
    canVerifyLabResult: true,
    canReleaseLabResult: true,
    canPrescribe: true,
    canDispense: true,
    canBill: true,
    canViewTimeline: true,
    canResetPlayground: true,
  },
};

export function getPermissionsForRole(role: DemoRole): DemoPermissions {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.reception;
}

export function canPerformAction(role: DemoRole, action: keyof DemoPermissions): boolean {
  return ROLE_PERMISSIONS[role]?.[action] ?? false;
}

export function normalizeDemoRole(role: string | null | undefined): DemoRole {
  if (role === "lab") return "lab_technician"
  if (role && role in ROLE_PERMISSIONS) return role as DemoRole
  return "reception"
}

export function currentDemoRole(): DemoRole {
  if (typeof window === "undefined") return "reception"
  return normalizeDemoRole(sessionStorage.getItem("synapse_demo_role"))
}

export function assertDemoPermission(role: DemoRole | string | null | undefined, action: keyof DemoPermissions) {
  const resolved = normalizeDemoRole(role ?? currentDemoRole())
  if (!canPerformAction(resolved, action)) {
    throw new Error(`DEMO_RBAC_DENIED:${action}`)
  }
}