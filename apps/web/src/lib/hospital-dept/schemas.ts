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

export const labOrderCreateSchema = z.object({
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  loinc_code: z.string().min(1).max(40),
  test_name: z.string().min(1).max(500),
  urgency: z.enum(['STAT', 'URGENT', 'ROUTINE']).optional(),
  care_plan_id: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
})

export const prescriptionCreateSchema = z.object({
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  medication_display: z.string().min(1).max(500),
  dose: z.string().min(1).max(2000),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(40).default('unit'),
  care_plan_id: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
  pharmacy_tenant_id: z.string().uuid().optional(),
})

export const hospitalDispenseSchema = z.object({
  prescription_id: z.string().uuid(),
  product_id: z.string().uuid(),
  pharmacy_tenant_id: z.string().uuid(),
  payment_method: z.string().min(1).max(40).default('cash'),
})

export const admissionCreateSchema = z.object({
  patient_id: z.string().uuid(),
  bed_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
  encounter_id: z.string().uuid().optional(),
})

export const vitalsRecordSchema = z.object({
  encounter_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  bp_systolic: z.coerce.number().min(50).max(300).optional(),
  bp_diastolic: z.coerce.number().min(20).max(200).optional(),
  heart_rate: z.coerce.number().min(20).max(250).optional(),
  respiratory_rate: z.coerce.number().min(5).max(60).optional(),
  temperature_c: z.coerce.number().min(30).max(43).optional(),
  spo2: z.coerce.number().min(50).max(100).optional(),
})
