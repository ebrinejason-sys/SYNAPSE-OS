import { useState, useEffect } from 'react';
import { supabase, demoQueries } from '../lib/supabase';

const MOCK_PATIENTS = [
  { id: 'p1', full_name: 'Ssemwanga John', mrn: 'MRN-00101', dob: '1996-03-14', sex: 'M', triage_status: 'RED', phone: '+256 772 100 001', district: 'Kampala', arrived_at: new Date(Date.now() - 10 * 60000).toISOString(), chief_complaint: 'High fever with rigors and chills', is_deleted: false },
  { id: 'p2', full_name: 'Nakato Sarah', mrn: 'MRN-00102', dob: '1990-07-22', sex: 'F', triage_status: 'YELLOW', phone: '+256 701 100 002', district: 'Wakiso', arrived_at: new Date(Date.now() - 25 * 60000).toISOString(), chief_complaint: 'Routine antenatal visit, 28 weeks', is_deleted: false },
  { id: 'p3', full_name: 'Okello Emmanuel', mrn: 'MRN-00103', dob: '1978-11-05', sex: 'M', triage_status: 'RED', phone: '+256 782 100 003', district: 'Gulu', arrived_at: new Date(Date.now() - 5 * 60000).toISOString(), chief_complaint: 'Chest pain radiating to left arm, diaphoresis', is_deleted: false },
  { id: 'p4', full_name: 'Atim Grace', mrn: 'MRN-00104', dob: '2018-04-30', sex: 'F', triage_status: 'YELLOW', phone: '+256 704 100 004', district: 'Lira', arrived_at: new Date(Date.now() - 40 * 60000).toISOString(), chief_complaint: 'Persistent cough for 3 weeks, weight loss', is_deleted: false },
  { id: 'p5', full_name: 'Mugisha Robert', mrn: 'MRN-00105', dob: '1985-09-18', sex: 'M', triage_status: 'GREEN', phone: '+256 756 100 005', district: 'Mbarara', arrived_at: new Date(Date.now() - 55 * 60000).toISOString(), chief_complaint: 'Hypertension follow-up, BP monitoring', is_deleted: false },
  { id: 'p6', full_name: 'Namukasa Fatuma', mrn: 'MRN-00106', dob: '2005-01-12', sex: 'F', triage_status: 'GREEN', phone: '+256 712 100 006', district: 'Jinja', arrived_at: new Date(Date.now() - 70 * 60000).toISOString(), chief_complaint: 'Abdominal pain, nausea, no vomiting', is_deleted: false },
  { id: 'p7', full_name: 'Ochen David', mrn: 'MRN-00107', dob: '1952-06-08', sex: 'M', triage_status: 'YELLOW', phone: '+256 774 100 007', district: 'Soroti', arrived_at: new Date(Date.now() - 80 * 60000).toISOString(), chief_complaint: 'Diabetes management, blood glucose uncontrolled', is_deleted: false },
  { id: 'p8', full_name: 'Nabifo Harriet', mrn: 'MRN-00108', dob: '1999-08-25', sex: 'F', triage_status: 'GREEN', phone: '+256 708 100 008', district: 'Mbale', arrived_at: new Date(Date.now() - 95 * 60000).toISOString(), chief_complaint: 'UTI symptoms, dysuria and frequency', is_deleted: false },
  { id: 'p9', full_name: 'Oryem Patrick', mrn: 'MRN-00109', dob: '2010-02-19', sex: 'M', triage_status: 'RED', phone: '+256 788 100 009', district: 'Arua', arrived_at: new Date(Date.now() - 3 * 60000).toISOString(), chief_complaint: 'Seizure episode, post-ictal state', is_deleted: false },
  { id: 'p10', full_name: 'Akello Josephine', mrn: 'MRN-00110', dob: '1965-12-03', sex: 'F', triage_status: 'YELLOW', phone: '+256 715 100 010', district: 'Masaka', arrived_at: new Date(Date.now() - 110 * 60000).toISOString(), chief_complaint: 'Joint pain and swelling, bilateral knees', is_deleted: false }
];

const MOCK_ENCOUNTER = {
  id: 'enc-demo',
  chief_complaint: 'High fever with rigors and chills',
  diagnosis: null,
  status: 'open',
  notes: 'Patient reports 3-day history of fever, shaking chills. Returned from Karamoja 1 week ago.',
  created_at: new Date().toISOString()
};

const MOCK_VITALS = [
  { id: 'v1', patient_id: 'p1', recorded_at: new Date().toISOString(), temperature: 39.2, heart_rate: 112, bp_systolic: 98, bp_diastolic: 62, spo2: 96, weight_kg: 68 }
];

export function useDemoPatientQueue() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demoQueries.getPatientQueue().then(({ data, error: err }) => {
      if (err || !data || data.length === 0) {
        setPatients(MOCK_PATIENTS);
      } else {
        setPatients(data);
      }
      setLoading(false);
    });
  }, []);

  return { patients, loading, error };
}

export function useDemoEncounter(encounterId: string) {
  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!encounterId) return;
    demoQueries.getEncounter(encounterId).then(({ data, error: err }) => {
      if (err || !data) {
        setEncounter(MOCK_ENCOUNTER);
      } else {
        setEncounter(data);
      }
      setLoading(false);
    });
  }, [encounterId]);

  return { encounter, loading, error };
}

export function useDemoPatients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demoQueries.getPatients().then(({ data, error: err }) => {
      if (err || !data || data.length === 0) {
        setPatients(MOCK_PATIENTS);
      } else {
        setPatients(data);
      }
      setLoading(false);
    });
  }, []);

  return { patients, loading, error };
}

export function useDemoGuidelines(category?: string) {
  const [guidelines, setGuidelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demoQueries.getGuidelines(category).then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setGuidelines(data || []);
      setLoading(false);
    });
  }, [category]);

  return { guidelines, loading, error };
}

export function useGuidelineSearch(term: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!term || term.length < 2) { setResults([]); return; }
    setLoading(true);
    demoQueries.searchGuidelines(term).then(({ data }) => {
      setResults(data || []);
      setLoading(false);
    });
  }, [term]);

  return { results, loading };
}

export function useDemoAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription?.unsubscribe();
  }, []);

  return { user, loading };
}

export const useDemoFacilities = () => ({ facilities: [], loading: false, error: null });
