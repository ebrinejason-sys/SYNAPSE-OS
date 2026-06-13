import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { symptoms, duration, severity, district, anonymous } = body

  if (!symptoms?.length) {
    return NextResponse.json({ error: 'symptoms required' }, { status: 400 })
  }

  const supabase = await createClient()
  const user = await getCurrentUser()

  const reportId = 'RPT-' + Math.random().toString(36).slice(2, 10).toUpperCase()

  await (supabase as any).from('surveillance_reports').insert({
    report_id: reportId,
    patient_id: anonymous ? null : (user?.id ?? null),
    symptoms,
    duration,
    severity,
    district,
    anonymous: anonymous ?? false,
    status: 'pending',
  })

  return NextResponse.json({ reportId })
}
