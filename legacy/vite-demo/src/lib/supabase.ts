/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Demo queries — use public.demo_* tables (RLS-free, pre-seeded)
export const demoQueries = {
  // All patients with their department
  getPatients: () =>
    supabase
      .from('demo_patients')
      .select(`*, department:demo_departments(name, code)`)
      .eq('is_deleted', false)
      .order('arrived_at', { ascending: true }),

  // Patient queue — patients with encounters joined
  getPatientQueue: () =>
    supabase
      .from('demo_patients')
      .select(`
        *,
        department:demo_departments(name, code),
        encounters:demo_encounters(id, chief_complaint, diagnosis, status)
      `)
      .eq('is_deleted', false)
      .order('arrived_at', { ascending: true }),

  // Single encounter with patient + vitals
  getEncounter: (encounterId: string) =>
    supabase
      .from('demo_encounters')
      .select(`
        *,
        patient:demo_patients(*),
        vitals:demo_vitals(*),
        orders:demo_encounter_orders(*),
        department:demo_departments(name, code)
      `)
      .eq('id', encounterId)
      .single(),

  // Encounters for a patient
  getPatientEncounters: (patientId: string) =>
    supabase
      .from('demo_encounters')
      .select(`*, orders:demo_encounter_orders(*)`)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),

  // Vitals for a patient
  getVitals: (patientId: string) =>
    supabase
      .from('demo_vitals')
      .select('*')
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false })
      .limit(10),

  // UCG clinical guidelines (real data, public schema)
  getGuidelines: (category?: string) => {
    const q = supabase
      .from('ucg_guidelines')
      .select('id, guideline_code, title, category, subcategory, content, icd11_codes')
      .eq('is_deleted', false)
      .order('category');
    return category ? q.ilike('category', `%${category}%`) : q;
  },

  searchGuidelines: (term: string) =>
    supabase
      .from('ucg_guidelines')
      .select('id, guideline_code, title, category, subcategory, content, icd11_codes')
      .or(`title.ilike.%${term}%,category.ilike.%${term}%,content.ilike.%${term}%`)
      .eq('is_deleted', false)
      .limit(5),

  // Departments
  getDepartments: () =>
    supabase
      .from('demo_departments')
      .select('*')
      .order('name'),
};

// Auth helpers
export const authHelpers = {
  loginDemo: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  logout: () => supabase.auth.signOut(),

  getCurrentUser: () => supabase.auth.getUser(),

  getSession: () => supabase.auth.getSession(),
};
