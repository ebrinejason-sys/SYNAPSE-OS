import { z } from 'zod'

export const patientRegisterSchema = z.object({
  full_name: z.string().min(1).max(200),
  dob: z.string().min(4).max(40).optional(),
  sex: z.enum(['M', 'F']),
  phone: z.string().max(30).optional(),
  district: z.string().max(100).optional(),
  nin: z.string().max(30).optional(),
})

export const triageSchema = z.object({
  patient_id: z.string().uuid(),
  chief_complaint: z.string().min(1).max(2000),
  clinical_stage: z.enum(['RED', 'YELLOW', 'GREEN']).optional(),
  bp_systolic: z.coerce.number().min(50).max(300).optional(),
  bp_diastolic: z.coerce.number().min(20).max(200).optional(),
  heart_rate: z.coerce.number().min(20).max(250).optional(),
  respiratory_rate: z.coerce.number().min(5).max(60).optional(),
  temperature_c: z.coerce.number().min(30).max(43).optional(),
  spo2: z.coerce.number().min(50).max(100).optional(),
})
