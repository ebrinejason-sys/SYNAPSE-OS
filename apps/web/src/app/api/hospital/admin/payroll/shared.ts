import { z } from 'zod'

/** Facility staff roles whose compensation a facility administrator manages. */
export const PAYROLL_STAFF_ROLES = new Set([
  'hospital_admin', 'admin', 'doctor', 'nurse', 'midwife', 'clinician', 'clinical_officer',
  'radiologist', 'radiographer', 'physiotherapist', 'receptionist', 'lab_admin', 'lab_scientist',
  'lab_technician', 'billing_officer', 'pharmacist', 'records_officer',
])

export const salaryPatchSchema = z.object({
  base_salary_ugx: z.number().finite().min(0).max(1_000_000_000),
}).strict()
