import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Only create client if URL is present to avoid crash on build/preview without env vars
export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

// Demo schema queries
export const DEMO_SCHEMA = 'demo';

const mockResult = { data: [], error: null };

export const demoQueries = {
  // Facilities
  getFacilities: () => 
    supabase
      ? supabase
          .from('facilities')
          .select('*')
          .eq('schema', DEMO_SCHEMA)
          .order('created_at', { ascending: false })
      : Promise.resolve(mockResult),

  // Patients
  getPatients: (facilityId?: string) =>
    supabase
      ? supabase
          .from('patients')
          .select('*')
          .eq('schema', DEMO_SCHEMA)
          .eq(facilityId ? 'facility_id' : 'id', facilityId || '')
          .order('created_at', { ascending: false })
      : Promise.resolve(mockResult),

  // Encounters
  getEncounters: (patientId?: string, facilityId?: string) =>
    supabase
      ? supabase
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
          .order('created_at', { ascending: false })
      : Promise.resolve(mockResult),

  // Queue (active encounters sorted by acuity)
  getPatientQueue: (facilityId: string) =>
    supabase
      ? supabase
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
          .order('created_at', { ascending: true })
      : Promise.resolve(mockResult),

  // Clinical Guidelines
  getGuidelines: (condition?: string) =>
    supabase
      ? supabase
          .from('clinical_guidelines')
          .select('*')
          .eq('schema', DEMO_SCHEMA)
          .eq(condition ? 'condition' : 'id', condition || '')
          .order('version', { ascending: false })
      : Promise.resolve(mockResult),

  // Insurance Providers
  getInsuranceProviders: (facilityId?: string) =>
    supabase
      ? supabase
          .from('insurance_providers')
          .select('*')
          .eq('schema', DEMO_SCHEMA)
          .eq(facilityId ? 'facility_id' : 'id', facilityId || '')
          .order('name', { ascending: true })
      : Promise.resolve(mockResult),

  // Lab Orders
  getLabOrders: (facilityId: string) =>
    supabase
      ? supabase
          .from('lab_orders')
          .select(`
            *,
            patient:patients(*),
            results:lab_results(*)
          `)
          .eq('schema', DEMO_SCHEMA)
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false })
      : Promise.resolve(mockResult),

  // Pharmacy Orders
  getPharmacyOrders: (facilityId: string) =>
    supabase
      ? supabase
          .from('pharmacy_orders')
          .select(`
            *,
            patient:patients(*),
            items:pharmacy_order_items(*)
          `)
          .eq('schema', DEMO_SCHEMA)
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false })
      : Promise.resolve(mockResult),
};

// Auth helpers
export const authHelpers = {
  loginDemo: (email: string, password: string) =>
    supabase ? supabase.auth.signInWithPassword({ email, password }) : Promise.resolve({ data: null, error: new Error('Supabase not configured') }),

  logout: () => supabase ? supabase.auth.signOut() : Promise.resolve({ error: null }),

  getCurrentUser: () => supabase ? supabase.auth.getUser() : Promise.resolve({ data: { user: null }, error: null }),

  getSession: () => supabase ? supabase.auth.getSession() : Promise.resolve({ data: { session: null }, error: null }),
};
