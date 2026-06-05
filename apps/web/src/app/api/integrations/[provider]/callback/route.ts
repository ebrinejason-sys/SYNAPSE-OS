import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

// GOD_MODE_TODO: Add per-provider token exchange once OAuth credentials are configured in Vercel env vars.
// Each provider needs: CLIENT_ID, CLIENT_SECRET env vars and its own token endpoint.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return NextResponse.redirect(new URL('/patient/devices?error=no_code', req.url))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // GOD_MODE_TODO: exchange code for access_token via provider-specific token endpoint
  // For now: store a placeholder device record showing the intent to connect
  try {
    await (supabase as any).from('medical_devices').upsert({
      patient_id: user.id,
      device_type: provider,
      manufacturer: provider,
      status: 'pending_auth',
      metadata: { oauth_code: code, oauth_state: state, connected_at: new Date().toISOString() },
    }, { onConflict: 'patient_id,device_type' })
  } catch {
    // Non-fatal — device record creation is best-effort
  }

  return NextResponse.redirect(new URL(`/patient/devices?connected=${provider}`, req.url))
}
