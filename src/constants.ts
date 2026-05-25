import { Patient, QueueItem, AuditLogEntry } from './types';

export const APP_NAME = "Synapse Ecosystem";

export const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    userId: 'u1',
    userName: 'Dr. Okello Moses',
    action: 'Patient Encounter Started',
    category: 'clinical',
    metadata: { patientId: 'p3', description: 'Emergency encounter initiated for Okello Emmanuel — chest pain' }
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    userId: 'u1',
    userName: 'Dr. Okello Moses',
    action: 'AI Diagnosis Run',
    category: 'clinical',
    metadata: { patientId: 'p1', description: 'Malaria RDT confirmation via Clinical Copilot for Ssemwanga John' }
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
    action: 'Inventory Audit',
    category: 'inventory',
    metadata: { description: 'Verified stock for IV Artesunate at Central Pharmacy' }
  }
];

export const DEMO_PATIENTS: Patient[] = [
  {
    id: 'p1',
    mrn: 'MRN-00101',
    name: 'Ssemwanga John',
    age: 29,
    gender: 'M',
    phone: '+256 772 100 001',
    insurance: { provider: 'IAA Healthcare', policyNumber: 'IAA-992211', status: 'ACTIVE' },
    allergies: ['Penicillin'],
    activeMeds: ['Paracetamol'],
    chronicConditions: ['None']
  },
  {
    id: 'p2',
    mrn: 'MRN-00102',
    name: 'Nakato Sarah',
    age: 35,
    gender: 'F',
    phone: '+256 701 100 002',
    insurance: { provider: 'UAP Old Mutual', policyNumber: 'UAP-443322', status: 'ACTIVE' },
    allergies: ['None'],
    activeMeds: ['Folic Acid', 'Ferrous Sulphate'],
    chronicConditions: ['Asthma']
  },
  {
    id: 'p3',
    mrn: 'MRN-00103',
    name: 'Okello Emmanuel',
    age: 47,
    gender: 'M',
    phone: '+256 782 100 003',
    insurance: { provider: 'Jubilee Insurance', policyNumber: 'JUB-771133', status: 'ACTIVE' },
    allergies: ['Aspirin'],
    activeMeds: ['Amlodipine', 'Atorvastatin'],
    chronicConditions: ['Hypertension', 'Dyslipidemia']
  },
  {
    id: 'p4',
    mrn: 'MRN-00104',
    name: 'Atim Grace',
    age: 7,
    gender: 'F',
    phone: '+256 704 100 004',
    insurance: { provider: 'None', policyNumber: '', status: 'UNINSURED' },
    allergies: ['None'],
    activeMeds: [],
    chronicConditions: ['None']
  },
  {
    id: 'p5',
    mrn: 'MRN-00105',
    name: 'Mugisha Robert',
    age: 40,
    gender: 'M',
    phone: '+256 756 100 005',
    insurance: { provider: 'APA Insurance', policyNumber: 'APA-556677', status: 'ACTIVE' },
    allergies: ['None'],
    activeMeds: ['Lisinopril', 'Hydrochlorothiazide'],
    chronicConditions: ['Hypertension']
  },
  {
    id: 'p6',
    mrn: 'MRN-00106',
    name: 'Namukasa Fatuma',
    age: 21,
    gender: 'F',
    phone: '+256 712 100 006',
    insurance: { provider: 'None', policyNumber: '', status: 'UNINSURED' },
    allergies: ['Sulfonamides'],
    activeMeds: [],
    chronicConditions: ['None']
  },
  {
    id: 'p7',
    mrn: 'MRN-00107',
    name: 'Ochen David',
    age: 73,
    gender: 'M',
    phone: '+256 774 100 007',
    insurance: { provider: 'NSSF', policyNumber: 'NSS-889900', status: 'ACTIVE' },
    allergies: ['None'],
    activeMeds: ['Metformin', 'Glibenclamide'],
    chronicConditions: ['Type 2 Diabetes Mellitus']
  },
  {
    id: 'p8',
    mrn: 'MRN-00108',
    name: 'Nabifo Harriet',
    age: 26,
    gender: 'F',
    phone: '+256 708 100 008',
    insurance: { provider: 'UAP Old Mutual', policyNumber: 'UAP-112233', status: 'ACTIVE' },
    allergies: ['None'],
    activeMeds: [],
    chronicConditions: ['None']
  },
  {
    id: 'p9',
    mrn: 'MRN-00109',
    name: 'Oryem Patrick',
    age: 15,
    gender: 'M',
    phone: '+256 788 100 009',
    insurance: { provider: 'None', policyNumber: '', status: 'UNINSURED' },
    allergies: ['None'],
    activeMeds: ['Sodium Valproate'],
    chronicConditions: ['Epilepsy']
  },
  {
    id: 'p10',
    mrn: 'MRN-00110',
    name: 'Akello Josephine',
    age: 60,
    gender: 'F',
    phone: '+256 715 100 010',
    insurance: { provider: 'IAA Healthcare', policyNumber: 'IAA-334455', status: 'ACTIVE' },
    allergies: ['NSAIDs'],
    activeMeds: ['Methotrexate'],
    chronicConditions: ['Rheumatoid Arthritis']
  }
];

export const DEMO_QUEUE: QueueItem[] = [
  { id: 'q9', patientId: 'p9', patientName: 'Oryem Patrick', acuity: 'RED', reason: 'Seizure — post-ictal', arrivalTime: new Date(Date.now() - 3 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q3', patientId: 'p3', patientName: 'Okello Emmanuel', acuity: 'RED', reason: 'Chest pain, diaphoresis', arrivalTime: new Date(Date.now() - 5 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q1', patientId: 'p1', patientName: 'Ssemwanga John', acuity: 'RED', reason: 'High fever & rigors', arrivalTime: new Date(Date.now() - 10 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q2', patientId: 'p2', patientName: 'Nakato Sarah', acuity: 'YELLOW', reason: 'Antenatal visit — 28wks', arrivalTime: new Date(Date.now() - 25 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q4', patientId: 'p4', patientName: 'Atim Grace', acuity: 'YELLOW', reason: 'Cough 3wks, weight loss', arrivalTime: new Date(Date.now() - 40 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q7', patientId: 'p7', patientName: 'Ochen David', acuity: 'YELLOW', reason: 'Uncontrolled blood glucose', arrivalTime: new Date(Date.now() - 80 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q10', patientId: 'p10', patientName: 'Akello Josephine', acuity: 'YELLOW', reason: 'Joint pain, bilateral knees', arrivalTime: new Date(Date.now() - 110 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q5', patientId: 'p5', patientName: 'Mugisha Robert', acuity: 'GREEN', reason: 'Hypertension follow-up', arrivalTime: new Date(Date.now() - 55 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q6', patientId: 'p6', patientName: 'Namukasa Fatuma', acuity: 'GREEN', reason: 'Abdominal pain, nausea', arrivalTime: new Date(Date.now() - 70 * 60000).toISOString(), status: 'WAITING' },
  { id: 'q8', patientId: 'p8', patientName: 'Nabifo Harriet', acuity: 'GREEN', reason: 'UTI symptoms', arrivalTime: new Date(Date.now() - 95 * 60000).toISOString(), status: 'WAITING' }
];
