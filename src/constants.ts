import { Patient, QueueItem, AuditLogEntry } from './types';

export const APP_NAME = "Synapse OS";

export const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    userId: 'u1',
    userName: 'Dr. Okello Moses',
    action: 'Patient Encounter Started',
    category: 'clinical',
    metadata: { patientId: 'p1', description: 'Started initial assessment for Ssemwanga John' }
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    userId: 'u1',
    userName: 'Dr. Okello Moses',
    action: 'Inventory Audit',
    category: 'inventory',
    metadata: { description: 'Verified stock for IV Artesunate at Central Pharmacy' }
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    userId: 'admin-1',
    userName: 'Systems Admin',
    action: 'User Permissions Updated',
    category: 'security',
    metadata: { description: 'Elevated Nurse Nnakku to Pharmacy Dispensing Role' }
  },
  {
    id: 'log-4',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    userId: 'u1',
    userName: 'Dr. Okello Moses',
    action: 'AI Diagnosis Run',
    category: 'clinical',
    metadata: { patientId: 'p2', description: 'Malaria RDT confirmation via Clinical Copilot' }
  }
];

export const DEMO_PATIENTS: Patient[] = [
  {
    id: 'p1',
    mrn: 'SYN-001',
    name: 'Ssemwanga John',
    age: 28,
    gender: 'M',
    phone: '+256 700 000 001',
    insurance: {
      provider: 'IAA Healthcare',
      policyNumber: 'IAA-992211',
      status: 'ACTIVE'
    },
    allergies: ['Penicillin'],
    activeMeds: ['Paracetamol'],
    chronicConditions: ['None']
  },
  {
    id: 'p2',
    mrn: 'SYN-002',
    name: 'Sarah Nakato',
    age: 34,
    gender: 'F',
    phone: '+256 700 000 002',
    insurance: {
      provider: 'UAP Old Mutual',
      policyNumber: 'UAP-443322',
      status: 'ACTIVE'
    },
    allergies: ['None'],
    activeMeds: [],
    chronicConditions: ['Asthma']
  }
];

export const DEMO_QUEUE: QueueItem[] = [
  {
    id: 'q1',
    patientId: 'p1',
    patientName: 'Ssemwanga John',
    acuity: 'RED',
    reason: 'High Fever & Rigors',
    arrivalTime: new Date().toISOString(),
    status: 'WAITING'
  },
  {
    id: 'q2',
    patientId: 'p2',
    patientName: 'Sarah Nakato',
    acuity: 'YELLOW',
    reason: 'Routine Antenatal Care',
    arrivalTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'WAITING'
  }
];
