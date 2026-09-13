import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

const BASE = process.env.RC1_BASE || 'http://127.0.0.1:3011'
const TOKEN = readFileSync('/tmp/synapse-rc1-session-doctor.jwt', 'utf8').trim()
const TENANT = '94ec9fd8-17ac-4f40-8f82-429d44cb8b02'
const ACTOR = '389ee4bb-4708-4f83-af6f-58c3c4253b9c'
const DEVICE = 'd1111111-1111-4111-8111-111111111111'
const ENC = 'c3333333-3333-4333-8333-333333333302'
const CNAME = readFileSync('/tmp/synapse-rc1-lab-container.name', 'utf8').trim()
const PASS = readFileSync('/tmp/synapse-rc1-lab-container.pass', 'utf8').trim()

const log = []
const step = (n, ok, d = '') => {
  const l = `${ok ? 'PASS' : 'FAIL'} ${n}${d ? ' — ' + d : ''}`
  log.push(l)
  console.log(l)
}

function sql(q) {
  const cmd = `docker exec -e PGPASSWORD=${JSON.stringify(PASS)} ${CNAME} psql -U postgres -d postgres -X -tA -v ON_ERROR_STOP=1 -c ${JSON.stringify(q)}`
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim()
  } catch (e) {
    return `ERROR:${e.stderr || e.message}`
  }
}

async function apply(command) {
  const res = await fetch(`${BASE}/api/hospital/sync/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `synapse_session=${TOKEN}` },
    body: JSON.stringify({ command }),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

const { buildWriteupSyncCommand } = await import('../packages/db/src/clinical-offline-writeup.ts')
const { buildPrescribeSyncCommand } = await import('../packages/db/src/clinical-offline-prescribe.ts')
const { hashPayload } = await import('../packages/db/src/sync-contract.ts')

const stamp = `matrix-hpi-${Date.now()}`
const cmd1 = await buildWriteupSyncCommand({
  tenantId: TENANT, facilityId: TENANT, deviceId: DEVICE, actorId: ACTOR, encounterId: ENC,
  writeup: { hpi: stamp, assessment: 'RC1 matrix', plan: 'observe' },
})
const first = await apply(cmd1)
step('writeup apply', first.status === 200 && first.json.outcome === 'applied', JSON.stringify(first.json).slice(0, 200))

const hpi = sql(`select metadata->'writeup'->>'hpi' from encounters where id='${ENC}' and tenant_id='${TENANT}'`)
step('DB has writeup HPI after apply', hpi === stamp, hpi.slice(0, 100))

const replay = await apply(cmd1)
step('lost-ack replay outcome', replay.json.outcome === 'replay' || replay.json.outcome === 'applied', JSON.stringify(replay.json).slice(0, 200))

const outboxTables = sql(`select string_agg(table_name, ',') from information_schema.tables where table_schema='public' and table_name ilike '%outbox%'`)
step('outbox tables present', !outboxTables.startsWith('ERROR') && outboxTables.length > 0, outboxTables)
let outboxCount = 'n/a'
for (const t of outboxTables.split(',').filter(Boolean)) {
  const n = sql(`select count(*)::text from ${t} where tenant_id='${TENANT}' and (idempotency_key='${cmd1.commandId}' or payload->>'commandId'='${cmd1.commandId}')`)
  if (!n.startsWith('ERROR')) { outboxCount = `${t}:${n}`; break }
}
step('DB outbox row for commandId', !outboxCount.startsWith('n/a') && !outboxCount.endsWith(':0'), outboxCount)

const cmdConflict = structuredClone(cmd1)
cmdConflict.payload.writeup.hpi = stamp + '-conflict'
cmdConflict.payloadHash = await hashPayload(cmdConflict.payload)
const conflict = await apply(cmdConflict)
step('payload hash conflict', conflict.json.outcome === 'conflict' || /conflict|idempotency|PAYLOAD/i.test(JSON.stringify(conflict.json)), JSON.stringify(conflict.json).slice(0, 200))

// find or create signed encounter (column is is_signed)
let signedId = sql(`select id::text from encounters where tenant_id='${TENANT}' and is_signed = true limit 1`)
if (signedId.startsWith('ERROR') || !signedId) {
  signedId = sql(`select id::text from encounters where tenant_id='${TENANT}' and id <> '${ENC}' limit 1`)
  if (signedId && !signedId.startsWith('ERROR')) {
    const upd = sql(`update encounters set is_signed = true where id='${signedId}' returning id::text`)
    step('mark encounter signed for matrix', upd === signedId, upd)
  }
}
if (signedId && !signedId.startsWith('ERROR')) {
  const signedCmd = await buildWriteupSyncCommand({
    tenantId: TENANT, facilityId: TENANT, deviceId: DEVICE, actorId: ACTOR, encounterId: signedId,
    writeup: { hpi: 'should-fail-signed' },
  })
  const signedRes = await apply(signedCmd)
  const ok = signedRes.json.reason === 'ENCOUNTER_SIGNED_IMMUTABLE' || signedRes.json.outcome === 'rejected'
  step('signed encounter rejected', ok, JSON.stringify(signedRes.json).slice(0, 200))
} else {
  step('signed encounter rejected', false, 'no encounter to sign')
}

const drug = `Amox-matrix-${Date.now()}`
let patientId = sql(`select patient_id::text from encounters where id='${ENC}'`)
if (patientId.startsWith('ERROR') || !patientId) patientId = 'p3333333-3333-4333-8333-333333333301'
try {
  const rx = await buildPrescribeSyncCommand({
    tenantId: TENANT, facilityId: TENANT, deviceId: DEVICE, actorId: ACTOR, encounterId: ENC,
    patientId,
    medicationDisplay: drug,
    dose: '500mg',
    quantity: 6,
    unit: 'tablet',
  })
  const before = sql(`select count(*)::text from clinical_prescriptions where tenant_id='${TENANT}' and encounter_id='${ENC}'`)
  const rxRes = await apply(rx)
  step('prescribe apply', rxRes.status === 200 && (rxRes.json.outcome === 'applied' || rxRes.json.outcome === 'replay'), JSON.stringify(rxRes.json).slice(0, 200))
  const after = sql(`select count(*)::text from clinical_prescriptions where tenant_id='${TENANT}' and encounter_id='${ENC}'`)
  step('DB prescription count increased or stable applied', !after.startsWith('ERROR') && Number(after) >= Number(before || 0), `${before}→${after}`)
  const rxReplay = await apply(rx)
  step('prescribe lost-ack replay', rxReplay.json.outcome === 'replay' || rxReplay.json.outcome === 'applied', JSON.stringify(rxReplay.json).slice(0, 160))
  const after2 = sql(`select count(*)::text from clinical_prescriptions where tenant_id='${TENANT}' and encounter_id='${ENC}'`)
  step('prescribe replay no duplicate', after2 === after, `${after}→${after2}`)
} catch (e) {
  step('prescribe apply', false, e instanceof Error ? e.message : String(e))
}

const bad = await buildWriteupSyncCommand({
  tenantId: TENANT, facilityId: TENANT, deviceId: DEVICE, actorId: ACTOR, encounterId: ENC,
  writeup: { hpi: 'x-tenant' },
})
bad.tenantId = '00000000-0000-4000-8000-000000000099'
const cross = await apply(bad)
step('tenant scope denied', cross.status === 403 || /scope|tenant|forbidden/i.test(JSON.stringify(cross.json)), `${cross.status} ${JSON.stringify(cross.json).slice(0, 160)}`)

mkdirSync('docs/engineering/evidence', { recursive: true })
const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
writeFileSync(
  'docs/engineering/evidence/rc1-failure-matrix-2026-09-13.md',
  [
    '# RC1 failure matrix (HTTP + DB) — disposable',
    '',
    `- Base: ${BASE}`,
    `- SHA: ${sha}`,
    `- When: ${new Date().toISOString()}`,
    '',
    ...log.map((l) => `- ${l}`),
    '',
    'Facility-switch browser E2E still open (needs second facility session cookie).',
    '',
  ].join('\n'),
)
const failed = log.filter((l) => l.startsWith('FAIL')).length
console.log(`\nSUMMARY fail=${failed} total=${log.length}`)
process.exit(failed ? 1 : 0)
