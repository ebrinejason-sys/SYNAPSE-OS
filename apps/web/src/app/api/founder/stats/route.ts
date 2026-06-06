import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET() {
  // Auth gate — must be signed in as super_admin / is_founder
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const meta = user.app_metadata as Record<string, unknown>
  if (meta?.role !== 'super_admin' && !meta?.is_founder) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const oneDayAgo    = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    hospitalsRes,
    totalProfilesRes,
    newSignupsRes,
    auditRes,
    waitlistRes,
    patientsRes,
    encountersRes,
  ] = await Promise.all([
    sb.from('hospitals').select('id,name,subdomain,type,created_at').order('created_at', { ascending: false }),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    sb.from('audit_log')
      .select('id,table_name,action,user_role,created_at,new_value')
      .order('created_at', { ascending: false })
      .limit(60),
    sb.from('apk_waitlist').select('id,created_at', { count: 'exact', head: false }).order('created_at', { ascending: false }),
    sb.from('patients').select('id', { count: 'exact', head: true }),
    sb.from('encounters').select('id', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
  ])

  // Recent auth signups from profiles (last 7 days, latest 10)
  const { data: recentUsers } = await sb
    .from('profiles')
    .select('id,full_name,email,role,created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    hospitals:      hospitalsRes.data    ?? [],
    totalProfiles:  totalProfilesRes.count ?? 0,
    newSignups:     newSignupsRes.count   ?? 0,
    auditLog:       auditRes.data         ?? [],
    waitlist:       waitlistRes.data      ?? [],
    totalPatients:  patientsRes.count     ?? 0,
    encountersToday: encountersRes.count  ?? 0,
    recentUsers:    recentUsers           ?? [],
  })
}
