import { z } from 'zod'

export const settingsPatchSchema = z.object({
  hospital_name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  currency_code: z.string().length(3).optional(),
  tax_rate_percent: z.number().min(0).max(100).optional(),
})

export const departmentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  dept_type: z.string().max(60).optional().default('general'),
  is_active: z.boolean().optional().default(true),
})

export const departmentPatchSchema = departmentCreateSchema.partial()

export const wardCreateSchema = z.object({
  name: z.string().min(1).max(120),
  capacity: z.number().int().min(0).max(500).optional().default(0),
  is_active: z.boolean().optional().default(true),
})

export const wardPatchSchema = wardCreateSchema.partial()

export const bedCreateSchema = z.object({
  bed_number: z.string().min(1).max(40),
  ward: z.string().min(1).max(80),
  bed_type: z.enum(['general', 'icu', 'maternity', 'pediatric', 'surgical', 'emergency']).optional().default('general'),
  building: z.string().max(80).optional().nullable(),
  floor: z.number().int().optional().nullable(),
  room: z.string().max(40).optional().nullable(),
  status: z.enum(['available', 'occupied', 'reserved', 'maintenance']).optional().default('available'),
})

export const bedPatchSchema = bedCreateSchema.partial()

const FACILITY_STAFF_ROLES = z.enum([
  'doctor',
  'nurse',
  'pharmacist',
  'lab_tech',
  'admin',
  'clinician',
  'radiologist',
  'physiotherapist',
  'receptionist',
])

export const staffInviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(120),
  role: FACILITY_STAFF_ROLES,
  phone: z.string().max(40).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
})

export const staffRolePatchSchema = z.object({
  role: FACILITY_STAFF_ROLES.optional(),
  department_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

export const moduleToggleSchema = z.object({
  module_key: z.string().min(1).max(60),
  is_active: z.boolean(),
})

export const serviceCreateSchema = z.object({
  name: z.string().min(1).max(200),
  service_type: z.string().max(60).optional().default('general'),
  price: z.number().min(0),
  currency: z.string().length(3).optional().default('UGX'),
  is_active: z.boolean().optional().default(true),
})

export const servicePatchSchema = serviceCreateSchema.partial()

export const auditQuerySchema = z.object({
  table_name: z.string().max(80).optional(),
  action: z.string().max(40).optional(),
  user_id: z.string().uuid().optional(),
  from: z.string().min(1).max(40).optional(),
  to: z.string().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
