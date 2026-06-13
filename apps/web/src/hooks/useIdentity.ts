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
    async function load() {
      try {
        let userId: string | null = null
        let email = ''
        let staffProfile: Identity['staffProfile'] | undefined
        let patientProfile: Identity['patientProfile'] | undefined

        // Try synapse_session first via server-side route
        const meRes = await fetch('/api/auth/me').catch(() => null)
        if (meRes?.ok) {
          let meData: { user: Record<string, unknown> | null } | null = null
          try { meData = await meRes.json() } catch {}
          const u = meData?.user
          if (u && typeof u.id === 'string') {
            userId = u.id
            email  = typeof u.email === 'string' ? u.email : ''

            if (u.hospitalId || u.tenantId || u.role) {
              staffProfile = {
                id:           userId,
                fullName:     typeof u.fullName === 'string' ? u.fullName : '',
                role:         (u.role as StaffRole) ?? 'admin',
                hospitalId:   typeof u.hospitalId === 'string' ? u.hospitalId : '',
                tenantId:     typeof u.tenantId === 'string' ? u.tenantId : '',
                departmentId: typeof u.departmentId === 'string' ? u.departmentId : undefined,
                isAdmin:      Boolean(u.isAdmin),
              }
            }

            if (u.patientProfile && typeof (u.patientProfile as Record<string, unknown>).id === 'string') {
              const pp = u.patientProfile as Record<string, unknown>
              patientProfile = {
                id:         pp.id as string,
                fullName:   typeof pp.fullName === 'string' ? pp.fullName : '',
                hospitalId: typeof pp.hospitalId === 'string' ? pp.hospitalId : undefined,
                phone:      typeof pp.phone === 'string' ? pp.phone : undefined,
              }
            }
          }
        }

        // Fall back to Supabase Auth for legacy sessions (these users have auth.uid() set, so RLS works)
        if (!userId) {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            userId = user.id
            email  = user.email ?? ''

            const [{ data: sp }, { data: pp }] = await Promise.all([
              (supabase as any).from('profiles')
                .select('id,full_name,role,hospital_id,tenant_id,department_id,is_admin')
                .eq('id', userId).maybeSingle(),
              (supabase as any).from('patient_profiles')
                .select('id,full_name,hospital_id,phone')
                .eq('id', userId).maybeSingle(),
            ])

            if (sp) {
              staffProfile = {
                id:           sp.id,
                fullName:     sp.full_name,
                role:         sp.role as StaffRole,
                hospitalId:   sp.hospital_id,
                tenantId:     sp.tenant_id,
                departmentId: sp.department_id,
                isAdmin:      sp.is_admin || false,
              }
            }
            if (pp) {
              patientProfile = {
                id:         pp.id,
                fullName:   pp.full_name,
                hospitalId: pp.hospital_id,
                phone:      pp.phone,
              }
            }
          }
        }

        if (!userId) { setIdentity(null); return }

        const both = !!(staffProfile && patientProfile)
        const stored = localStorage.getItem(`synapse-mode-${userId}`) as 'staff' | 'patient' | null
        const defaultMode: 'staff' | 'patient' = stored || (staffProfile ? 'staff' : 'patient')

        const switchMode = (m: 'staff' | 'patient') => {
          localStorage.setItem(`synapse-mode-${userId}`, m)
          setIdentity(prev => prev && prev !== 'loading' ? { ...prev, activeMode: m } : prev)
        }

        setIdentity({ userId, email, activeMode: defaultMode, staffProfile, patientProfile, hasBothModes: both, switchMode })
      } catch {
        setIdentity(null)
      }
    }

    load()
  }, [])

  return identity
}
