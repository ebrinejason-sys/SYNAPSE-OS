import { useState, useEffect } from 'react';
import { supabase, demoQueries } from '../lib/supabase';

// Demo patient queue hook
export function useDemoPatientQueue(facilityId: string) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await demoQueries.getPatientQueue(facilityId);
        if (err) throw err;
        setPatients(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (facilityId) {
      fetchQueue();
    }
  }, [facilityId]);

  return { patients, loading, error };
}

// Demo encounter details hook
export function useDemoEncounter(encounterId: string) {
  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEncounter = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from('encounters')
          .select(`
            *,
            patient:patients(*),
            diagnoses:encounter_diagnoses(*),
            observations:observations(*),
            orders:orders(*)
          `)
          .eq('schema', 'demo')
          .eq('id', encounterId)
          .single();
        if (err) throw err;
        setEncounter(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (encounterId) {
      fetchEncounter();
    }
  }, [encounterId]);

  return { encounter, loading, error };
}

// Demo patients hook
export function useDemoPatients(facilityId?: string) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await demoQueries.getPatients(facilityId);
        if (err) throw err;
        setPatients(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [facilityId]);

  return { patients, loading, error };
}

// Demo facilities hook
export function useDemoFacilities() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await demoQueries.getFacilities();
        if (err) throw err;
        setFacilities(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFacilities();
  }, []);

  return { facilities, loading, error };
}

// Demo guidelines hook
export function useDemoGuidelines(condition?: string) {
  const [guidelines, setGuidelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuidelines = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await demoQueries.getGuidelines(condition);
        if (err) throw err;
        setGuidelines(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGuidelines();
  }, [condition]);

  return { guidelines, loading, error };
}

// Demo auth state hook
export function useDemoAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      } catch (err) {
        console.error('Auth error:', err);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  return { user, loading };
}
