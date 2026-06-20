const FLW_BASE = 'https://api.flutterwave.com/v3'

export type FlutterwaveInitParams = {
  txRef: string
  amountUgx: number
  email: string
  name: string
  phone?: string
  title: string
  description: string
  redirectUrl: string
}

export type FlutterwaveInitResult = {
  link: string
  flwRef: string
}

function secretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY
  if (!key) throw new Error('FLUTTERWAVE_SECRET_KEY is not configured')
  return key
}

export function webhookSecret(): string {
  return process.env.FLUTTERWAVE_WEBHOOK_SECRET ?? process.env.FLUTTERWAVE_SECRET_KEY ?? ''
}

export function verifyWebhookHash(header: string | null): boolean {
  if (!header) return false
  const expected = webhookSecret()
  if (!expected) return false
  return header === expected
}

export async function initFlutterwavePayment(params: FlutterwaveInitParams): Promise<FlutterwaveInitResult> {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: params.amountUgx,
      currency: 'UGX',
      redirect_url: params.redirectUrl,
      customer: {
        email: params.email,
        name: params.name,
        phonenumber: params.phone ?? '',
      },
      customizations: {
        title: params.title,
        description: params.description,
        logo: 'https://synapseos.tech/synapse-logo-dark.png',
      },
      payment_options: 'mobilemoneyuganda,card',
    }),
  })

  const json = (await res.json()) as {
    status?: string
    message?: string
    data?: { link?: string; flw_ref?: string }
  }

  if (!res.ok || json.status !== 'success' || !json.data?.link) {
    throw new Error(json.message ?? `Flutterwave init failed (${res.status})`)
  }

  return {
    link: json.data.link,
    flwRef: json.data.flw_ref ?? params.txRef,
  }
}

export async function verifyFlutterwaveTransaction(txId: string): Promise<{ ok: boolean; status?: string }> {
  const res = await fetch(`${FLW_BASE}/transactions/${encodeURIComponent(txId)}/verify`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  })
  const json = (await res.json()) as { status?: string; data?: { status?: string } }
  if (json.status !== 'success') return { ok: false }
  return { ok: json.data?.status === 'successful', status: json.data?.status }
}
