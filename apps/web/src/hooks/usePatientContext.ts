'use client'

import { useState, useCallback } from 'react'

export interface SelectedPatient {
  id: string
  fullName: string
  mrn: string | null
}

export function usePatientContext() {
  const [patient, setPatientState] = useState<SelectedPatient | null>(null)

  const setPatient = useCallback((p: SelectedPatient | null) => {
    setPatientState(p)
  }, [])

  return { patient, setPatient }
}
