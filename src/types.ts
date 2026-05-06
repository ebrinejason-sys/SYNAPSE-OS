export enum UserRole {
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  PHARMACIST = 'pharmacist',
  LAB_TECH = 'lab_tech',
  ADMIN = 'admin',
  PATIENT = 'patient',
  FOUNDER = 'founder'
}

export type Acuity = 'RED' | 'YELLOW' | 'GREEN';

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'O';
  phone: string;
  email?: string;
  insurance?: {
    provider: string;
    policyNumber: string;
    status: 'ACTIVE' | 'PENDING' | 'EXPIRED';
  };
  allergies?: string[];
  activeMeds?: string[];
  chronicConditions?: string[];
}

export interface QueueItem {
  id: string;
  patientId: string;
  patientName: string;
  acuity: Acuity;
  reason: string;
  arrivalTime: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface Encounter {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  history: string;
  exam: string;
  diagnosis?: {
    icd11: string;
    title: string;
    concordance: number;
    citations: string[];
  };
  orders: {
    type: 'LAB' | 'PHARMACY';
    code: string;
    description: string;
    status: 'PENDING' | 'SIGNED' | 'COMPLETED';
  }[];
  signed: boolean;
}

export interface DemoState {
  patients: Patient[];
  queue: QueueItem[];
  encounters: Encounter[];
  auditLogs: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  category: 'clinical' | 'administrative' | 'security' | 'inventory';
  metadata?: {
    patientId?: string;
    recordId?: string;
    description?: string;
  };
}
