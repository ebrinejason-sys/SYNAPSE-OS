#!/usr/bin/env node
/**
 * Live SYNAPSE Pharm probes. Never runs unless explicitly enabled.
 *
 * Required:
 *   SYNAPSE_PHARM_LIVE=1
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional isolation JWTs (missing => FAIL, not PASS):
 *   SYNAPSE_PHARM_LIVE_TENANT_A_JWT
 *   SYNAPSE_PHARM_LIVE_TENANT_B_JWT
 *   SYNAPSE_PHARM_LIVE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js'

const enabled = process.env.SYNAPSE_PHARM_LIVE === '1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const results = []

function record(name, outcome, detail = '') {
  results.push({ name, outcome, detail })
  console.log(`[verify:pharm-live] ${outcome.padEnd(7)} ${name}${detail ? ` — ${detail}` : ''}`)
}

function printSummary(final) {
  console.log('\n[verify:pharm-live] summary')
  for (const row of results) {
    console.log(`  ${row.outcome.padEnd(8)} ${row.name}${row.detail ? ` (${row.detail})` : ''}`)
  }
  console.log(`\nLIVE_GATE=${final}`)
}

if (!enabled) {
  console.error('[verify:pharm-live] Refusing to run. Set SYNAPSE_PHARM_LIVE=1.')
  printSummary('FAIL')
  process.exit(1)
}
if (!url || /placeholder/i.test(url) || !serviceKey) {
  console.error('[verify:pharm-live] Live URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  printSummary('FAIL')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const NIL = '00000000-0000-0000-0000-000000000000'

async function rpcExists(name, args) {
  const { error } = await admin.rpc(name, args)
  if (!error) return { present: true, error: null }
  const message = error.message ?? ''
  if (/could not find the function|schema cache/i.test(message)) {
    return { present: false, error: message }
  }
  return { present: true, error: message }
}

const transferArgs = { p_tenant_id: NIL, p_transfer_id: NIL, p_actor_id: NIL }
const checks = [
  ['ship_pharmacy_stock_transfer', transferArgs],
  ['receive_pharmacy_stock_transfer', transferArgs],
  [
    'reverse_pharmacy_sale',
    { p_tenant_id: NIL, p_sale_id: NIL, p_actor_id: NIL, p_reason: 'probe', p_restore_as: 'quarantined' },
  ],
]

for (const [name, args] of checks) {
  const result = await rpcExists(name, args)
  if (result.present) record(`rpc:${name}`, 'PASS', result.error ? 'callable' : 'returned')
  else record(`rpc:${name}`, 'FAIL', result.error)
}

const { error: saleError } = await admin.rpc('complete_pharmacy_sale', {
  p_tenant_id: NIL,
  p_cashier_id: NIL,
  p_items: [],
  p_payment_method: 'cash',
})
if (saleError && /could not find the function|schema cache/i.test(saleError.message ?? '')) {
  record('rpc:complete_pharmacy_sale', 'FAIL', saleError.message)
} else {
  record('rpc:complete_pharmacy_sale', 'PASS', 'callable')
}

const { error: tillError } = await admin
  .from('pharmacy_cashier_sessions')
  .select('id, cash_in, cash_out, cash_payment_total, cash_refund_total, variance_reason, device_id, opened_by')
  .limit(1)
if (tillError && /column .* does not exist|schema cache/i.test(tillError.message ?? '')) {
  record('schema:pharmacy_cashier_sessions_v1', 'FAIL', tillError.message)
} else {
  record('schema:pharmacy_cashier_sessions_v1', tillError ? 'FAIL' : 'PASS', tillError?.message ?? '')
}

const { error: allocError } = await admin
  .from('pharmacy_stock_transfer_item_allocations')
  .select('id')
  .limit(1)
if (allocError && /does not exist|schema cache/i.test(allocError.message ?? '')) {
  record('schema:pharmacy_stock_transfer_item_allocations', 'FAIL', allocError.message)
} else {
  record('schema:pharmacy_stock_transfer_item_allocations', allocError ? 'FAIL' : 'PASS', allocError?.message ?? '')
}

const { error: transferColError } = await admin
  .from('pharmacy_stock_transfers')
  .select('id, shipped_by, shipped_at')
  .limit(1)
if (transferColError && /column .* does not exist/i.test(transferColError.message ?? '')) {
  record('schema:pharmacy_stock_transfers.shipped_by', 'FAIL', transferColError.message)
} else {
  record('schema:pharmacy_stock_transfers.shipped_by', transferColError ? 'FAIL' : 'PASS', transferColError?.message ?? '')
}

const anonKey = process.env.SYNAPSE_PHARM_LIVE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const jwtA = process.env.SYNAPSE_PHARM_LIVE_TENANT_A_JWT ?? ''
const jwtB = process.env.SYNAPSE_PHARM_LIVE_TENANT_B_JWT ?? ''

if (!anonKey || !jwtA || !jwtB) {
  record(
    'tenant-isolation-jwt',
    'FAIL',
    'SYNAPSE_PHARM_LIVE_TENANT_A_JWT / B_JWT and anon key are required for isolation proof',
  )
} else {
  const userA = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwtA}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const userB = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwtB}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const tables = [
    'pharmacy_products',
    'pharmacy_pos_sales',
    'pharmacy_product_batches',
    'pharmacy_stock_transfers',
  ]
  for (const table of tables) {
    const { data: rowsA, error: errA } = await userA.from(table).select('id, tenant_id').limit(20)
    const { data: rowsB, error: errB } = await userB.from(table).select('id, tenant_id').limit(20)
    if (errA || errB) {
      record(`isolation:${table}`, 'FAIL', (errA ?? errB)?.message ?? 'query failed')
      continue
    }
    const aTenants = new Set((rowsA ?? []).map((row) => row.tenant_id).filter(Boolean))
    const bTenants = new Set((rowsB ?? []).map((row) => row.tenant_id).filter(Boolean))
    const overlap = [...aTenants].some((id) => bTenants.has(id))
    record(
      `isolation:${table}`,
      overlap ? 'FAIL' : 'PASS',
      overlap ? 'tenant ids overlapped in user-scoped reads' : '',
    )
  }

  const { error: shipDenied } = await userA.rpc('ship_pharmacy_stock_transfer', transferArgs)
  if (!shipDenied) {
    record('rpc-grant:authenticated-cannot-ship', 'FAIL', 'authenticated user executed privileged RPC')
  } else if (/could not find the function/i.test(shipDenied.message ?? '')) {
    record('rpc-grant:authenticated-cannot-ship', 'FAIL', 'function missing')
  } else {
    record('rpc-grant:authenticated-cannot-ship', 'PASS', 'direct client execute denied')
  }
}

const failed = results.some((row) => row.outcome === 'FAIL')
printSummary(failed ? 'FAIL' : 'PASS')
process.exit(failed ? 1 : 0)
