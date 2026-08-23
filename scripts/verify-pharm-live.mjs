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
const bProduct = process.env.SYNAPSE_PHARM_LIVE_B_PRODUCT_ID ?? ''
const bBatch = process.env.SYNAPSE_PHARM_LIVE_B_BATCH_ID ?? ''
const bSale = process.env.SYNAPSE_PHARM_LIVE_B_SALE_ID ?? ''
const bTransfer = process.env.SYNAPSE_PHARM_LIVE_B_TRANSFER_ID ?? ''
const aProduct = process.env.SYNAPSE_PHARM_LIVE_A_PRODUCT_ID ?? ''
const aBatch = process.env.SYNAPSE_PHARM_LIVE_A_BATCH_ID ?? ''
const aSale = process.env.SYNAPSE_PHARM_LIVE_A_SALE_ID ?? ''
const aTransfer = process.env.SYNAPSE_PHARM_LIVE_A_TRANSFER_ID ?? ''

function clientFor(jwt) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function expectHidden(user, table, id, label) {
  if (!id) {
    record(label, 'FAIL', `missing fixture id for ${table}`)
    return
  }
  const { data, error } = await user.from(table).select('id').eq('id', id)
  if (error && /permission|rls|policy|row-level/i.test(error.message ?? '')) {
    record(label, 'PASS', 'policy denied')
    return
  }
  if (error) {
    record(label, 'FAIL', error.message)
    return
  }
  record(label, (data ?? []).length === 0 ? 'PASS' : 'FAIL', (data ?? []).length ? 'foreign row visible' : '0 rows')
}

async function expectRpcDenied(user, name, args, label) {
  const { error } = await user.rpc(name, args)
  if (!error) {
    record(label, 'FAIL', `${name} succeeded for a client JWT`)
    return
  }
  if (/could not find the function/i.test(error.message ?? '')) {
    record(label, 'FAIL', 'function missing')
    return
  }
  record(label, 'PASS', 'denied')
}

if (anonKey) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  await expectRpcDenied(anon, 'complete_pharmacy_sale', { p_tenant_id: NIL, p_cashier_id: NIL, p_items: [], p_payment_method: 'cash' }, 'rpc-grant:anon-cannot-complete_pharmacy_sale')
  await expectRpcDenied(anon, 'reverse_pharmacy_sale', { p_tenant_id: NIL, p_sale_id: NIL, p_actor_id: NIL, p_reason: 'probe', p_restore_as: 'quarantined' }, 'rpc-grant:anon-cannot-reverse_pharmacy_sale')
  await expectRpcDenied(anon, 'ship_pharmacy_stock_transfer', transferArgs, 'rpc-grant:anon-cannot-ship_pharmacy_stock_transfer')
  await expectRpcDenied(anon, 'receive_pharmacy_stock_transfer', transferArgs, 'rpc-grant:anon-cannot-receive_pharmacy_stock_transfer')
} else {
  record('rpc-grant:anon', 'FAIL', 'anon key required to prove GRANT EXECUTE is revoked')
}

if (!anonKey || !jwtA || !jwtB) {
  record(
    'tenant-isolation-jwt',
    'FAIL',
    'Set SYNAPSE_PHARM_LIVE=1 NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY SYNAPSE_PHARM_LIVE_TENANT_A_JWT SYNAPSE_PHARM_LIVE_TENANT_B_JWT SYNAPSE_PHARM_LIVE_A_PRODUCT_ID SYNAPSE_PHARM_LIVE_A_BATCH_ID SYNAPSE_PHARM_LIVE_A_SALE_ID SYNAPSE_PHARM_LIVE_A_TRANSFER_ID SYNAPSE_PHARM_LIVE_B_PRODUCT_ID SYNAPSE_PHARM_LIVE_B_BATCH_ID SYNAPSE_PHARM_LIVE_B_SALE_ID SYNAPSE_PHARM_LIVE_B_TRANSFER_ID then run npm run verify:pharm-live',
  )
} else {
  const userA = clientFor(jwtA)
  const userB = clientFor(jwtB)

  await expectHidden(userA, 'pharmacy_products', bProduct, 'attack:A-read-B-product')
  await expectHidden(userA, 'pharmacy_product_batches', bBatch, 'attack:A-read-B-batch')
  await expectHidden(userA, 'pharmacy_pos_sales', bSale, 'attack:A-read-B-sale')
  await expectHidden(userA, 'pharmacy_stock_transfers', bTransfer, 'attack:A-read-B-transfer')
  await expectHidden(userB, 'pharmacy_products', aProduct, 'attack:B-read-A-product')
  await expectHidden(userB, 'pharmacy_product_batches', aBatch, 'attack:B-read-A-batch')
  await expectHidden(userB, 'pharmacy_pos_sales', aSale, 'attack:B-read-A-sale')
  await expectHidden(userB, 'pharmacy_stock_transfers', aTransfer, 'attack:B-read-A-transfer')

  if (bProduct) {
    const { data, error } = await userA.from('pharmacy_products').update({ name: 'cross-tenant-write' }).eq('id', bProduct).select('id')
    record('attack:A-update-B-product', error || !(data ?? []).length ? 'PASS' : 'FAIL', error?.message ?? ((data ?? []).length ? 'update succeeded' : '0 rows'))
  } else {
    record('attack:A-update-B-product', 'FAIL', 'missing SYNAPSE_PHARM_LIVE_B_PRODUCT_ID')
  }

  await expectRpcDenied(userA, 'reverse_pharmacy_sale', { p_tenant_id: NIL, p_sale_id: bSale || NIL, p_actor_id: NIL, p_reason: 'cross-tenant', p_restore_as: 'quarantined' }, 'attack:A-refund-B-sale')
  await expectRpcDenied(userA, 'ship_pharmacy_stock_transfer', { p_tenant_id: NIL, p_transfer_id: bTransfer || NIL, p_actor_id: NIL }, 'attack:A-ship-B-transfer')
  await expectRpcDenied(userA, 'receive_pharmacy_stock_transfer', { p_tenant_id: NIL, p_transfer_id: bTransfer || NIL, p_actor_id: NIL }, 'attack:A-receive-B-transfer')
  await expectRpcDenied(userA, 'complete_pharmacy_sale', { p_tenant_id: NIL, p_cashier_id: NIL, p_items: [], p_payment_method: 'cash' }, 'rpc-grant:authenticated-cannot-complete-sale')
}

const failed = results.some((row) => row.outcome === 'FAIL')
printSummary(failed ? 'FAIL' : 'PASS')
process.exit(failed ? 1 : 0)
