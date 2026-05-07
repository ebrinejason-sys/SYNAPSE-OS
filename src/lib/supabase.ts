import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Demo schema queries
export const DEMO_SCHEMA = 'demo';

export const demoQueries = {
  // Facilities
  getFacilities: () => 
    supabase
      .from('facilities')
      .select('*')
      .eq('schema', DEMO_SCHEMA)
      .order('created_at', { ascending: false }),

  // Patients
  getPatients: (facilityId?: string) =>
    supabase
      .from('patients')
      .select('*')
      .eq('schema', DEMO_SCHEMA)
      .eq(facilityId ? 'facility_id' : 'id', facilityId || '')
      .order('created_at', { ascending: false }),

  // Encounters
  getEncounters: (patientId?: string, facilityId?: string) =>
    supabase
      .from('encounters')
      .select(`
        *,
        patient:patients(*),
        diagnoses:encounter_diagnoses(*),
        observations:observations(*),
        orders:orders(*)
      `)
      .eq('schema', DEMO_SCHEMA)
      .eq(patientId ? 'patient_id' : 'id', patientId || '')
      .eq(facilityId ? 'facility_id' : 'id', facilityId || '')
      .order('created_at', { ascending: false }),

  // Queue (active encounters sorted by acuity)
  getPatientQueue: (facilityId: string) =>
    supabase
      .from('encounters')
      .select(`
        *,
        patient:patients(*),
        acuity_level,
        status
      `)
      .eq('schema', DEMO_SCHEMA)
      .eq('facility_id', facilityId)
      .in('status', ['active', 'waiting'])
      .order('acuity_level', { ascending: false })
      .order('created_at', { ascending: true }),

  // Clinical Guidelines
  getGuidelines: (condition?: string) =>
    supabase
      .from('clinical_guidelines')
      .select('*')
      .eq('schema', DEMO_SCHEMA)
      .eq(condition ? 'condition' : 'id', condition || '')
      .order('version', { ascending: false }),

  // Insurance Providers
  getInsuranceProviders: (facilityId?: string) =>
    supabase
      .from('insurance_providers')
      .select('*')
      .eq('schema', DEMO_SCHEMA)
      .eq(facilityId ? 'facility_id' : 'id', facilityId || '')
      .order('name', { ascending: true }),

  // Lab Orders
  getLabOrders: (facilityId: string) =>
    supabase
      .from('lab_orders')
      .select(`
        *,
        patient:patients(*),
        results:lab_results(*)
      `)
      .eq('schema', DEMO_SCHEMA)
      .eq('facility_id', facilityId)
      .order('created_at', { ascending: false }),

  // Pharmacy Orders
  getPharmacyOrders: (facilityId: string) =>
    supabase
      .from('pharmacy_orders')
      .select(`
        *,
        patient:patients(*),
        items:pharmacy_order_items(*)
      `)
      .eq('schema', DEMO_SCHEMA)
      .eq('facility_id', facilityId)
      .order('created_at', { ascending: false }),
};

// Auth helpers
export const authHelpers = {
  loginDemo: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  logout: () => supabase.auth.signOut(),

  getCurrentUser: () => supabase.auth.getUser(),

  getSession: () => supabase.auth.getSession(),
};
