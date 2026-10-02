import { NextRequest, NextResponse } from 'next/server'
import { handleFlutterwaveWebhook, verifyWebhookHash } from '@synapse/auth'

export const dynamic = 'force-dynamic'

/**
 * Flutterwave webhook endpoint.
 *
 * CANONICAL webhook for ALL Synapse subscription payments (OS, Lab and Pharmacy —
 * pharmacy checkout tx_refs are created in apps/pharmacy but confirmed here; both
 * apps share one database).
 *
 * Service: apps/web → Vercel project "synapse-os" (team synapse-os1).
 * Required env on THAT project: FLUTTERWAVE_WEBHOOK_SECRET (dashboard "Secret hash",
 * compared in constant time with the verif-hash header; the API secret key is never
 * accepted) and FLUTTERWAVE_SECRET_KEY (server-side re-verification of every charge).
 *
 * Dashboard setup (Flutterwave > Settings > Webhooks):
 *   URL:    https://synapseos.tech/api/billing/webhook/flutterwave
 *   Secret: same value as FLUTTERWAVE_WEBHOOK_SECRET on synapse-os
 *
 * Events to enable: charge.completed
 */
export async function POST(req: NextRequest) {
  const verifHash = req.headers.get('verif-hash')
  if (!verifyWebhookHash(verifHash)) {
    console.warn('[flw-webhook] rejected: bad verif-hash')
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const p = payload as Parameters<typeof handleFlutterwaveWebhook>[0]
  const result = await handleFlutterwaveWebhook(p)
  // One structured line per webhook so Vercel logs are auditable end-to-end.
  console.log(
    `[flw-webhook] event=${p?.event ?? 'unknown'} tx_ref=${p?.data?.tx_ref ?? '-'} flw_id=${p?.data?.id ?? '-'} ok=${result.ok} idempotent=${result.idempotent ?? false} error=${result.error ?? '-'}`,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'processing_failed' }, { status: 422 })
  }

  return NextResponse.json({ received: true, idempotent: result.idempotent ?? false })
}
