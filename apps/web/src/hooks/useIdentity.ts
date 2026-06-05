'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase/client'

export type StaffRole = 'doctor' | 'nurse' | 'pharmacist' | 'admin' | 'lab'

export interface Identity {
  userId: string
  email: string
  activeMode: 'patient' | 'staff'
  staffProfile?: {
    id: string
    fullName: string
    role: StaffRole
    hospitalId: string
    tenantId: string
    departmentId?: string
    isAdmin: boolean
  }
  patientProfile?: {
    id: string
    fullName: string
    hospitalId?: string
    phone?: string
  }
  hasBothModes: boolean
  switchMode: (m: 'patient' | 'staff') => void
}

export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null | 'loading'>('loading')

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIdentity(null); return }

      const [{ data: sp }, { data: pp }] = await Promise.all([
        (supabase as any).from('profiles')
          .select('id,full_name,role,hospital_id,tenant_id,department_id,is_admin')
          .eq('id', user.id).single(),
        (supabase as any).from('patient_profiles')
          .select('id,full_name,hospital_id,phone')
          .eq('id', user.id).single(),
      ])

      const both = !!(sp && pp)
      const stored = localStorage.getItem(`synapse-mode-${user.id}`) as 'staff' | 'patient' | null
      const defaultMode: 'staff' | 'patient' = stored || (sp ? 'staff' : 'patient')

      const switchMode = (m: 'staff' | 'patient') => {
        localStorage.setItem(`synapse-mode-${user.id}`, m)
        setIdentity(prev => prev && prev !== 'loading' ? { ...prev, activeMode: m } : prev)
      }

      setIdentity({
        userId: user.id,
        email: user.email || '',
        activeMode: defaultMode,
        staffProfile: sp ? {
          id: sp.id,
          fullName: sp.full_name,
          role: sp.role as StaffRole,
          hospitalId: sp.hospital_id,
          tenantId: sp.tenant_id,
          departmentId: sp.department_id,
          isAdmin: sp.is_admin || false,
        } : undefined,
        patientProfile: pp ? {
          id: pp.id,
          fullName: pp.full_name,
          hospitalId: pp.hospital_id,
          phone: pp.phone,
        } : undefined,
        hasBothModes: both,
        switchMode,
      })
    }

    load()
  }, [])

  return identity
}
