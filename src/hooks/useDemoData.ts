import { useState, useEffect } from 'react';
import { supabase, demoQueries } from '../lib/supabase';

export function useDemoPatientQueue() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demoQueries.getPatientQueue().then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setPatients(data || []);
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
      if (err) setError(err.message);
      else setEncounter(data);
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
      if (err) setError(err.message);
      else setPatients(data || []);
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

// Legacy alias kept for compatibility
export const useDemoFacilities = () => ({ facilities: [], loading: false, error: null });
