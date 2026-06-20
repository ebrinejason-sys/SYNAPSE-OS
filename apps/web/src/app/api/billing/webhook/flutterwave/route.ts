import { NextRequest, NextResponse } from 'next/server'
import { handleFlutterwaveWebhook, verifyWebhookHash } from '@synapse/auth'

export const dynamic = 'force-dynamic'

/**
 * Flutterwave webhook endpoint.
 *
 * Dashboard setup (Flutterwave > Settings > Webhooks):
 *   URL:    https://synapseos.tech/api/billing/webhook/flutterwave
 *   Secret: same value as FLUTTERWAVE_WEBHOOK_SECRET (sent as verif-hash header)
 *
 * Events to enable: charge.completed
 */
export async function POST(req: NextRequest) {
  const verifHash = req.headers.get('verif-hash')
  if (!verifyWebhookHash(verifHash)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = await handleFlutterwaveWebhook(payload as Parameters<typeof handleFlutterwaveWebhook>[0])
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'processing_failed' }, { status: 422 })
  }

  return NextResponse.json({ received: true, idempotent: result.idempotent ?? false })
}
