#!/usr/bin/env node
/**
 * Write docs/release/pharm-v1-green-evidence.json for the current git HEAD.
 * Never hard-codes an older SHA. Status values must be supplied by the caller
 * or left BLOCKED/FAIL — this script will not invent PASS.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const sha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim()
const appJson = JSON.parse(readFileSync(join(root, 'apps/app/app.json'), 'utf8'))
const previousPath = join(root, 'docs/release/pharm-v1-green-evidence.json')
const previous = JSON.parse(readFileSync(previousPath, 'utf8'))

const next = {
  ...previous,
  commit: sha,
  version: appJson.expo?.version ?? previous.version,
  androidVersionCode: appJson.expo?.android?.versionCode ?? previous.androidVersionCode,
  recordedAt: new Date().toISOString(),
  note: 'commit is git rev-parse HEAD at write time. Re-run every gate if this SHA changes.',
}

if (process.env.PHARM_EVIDENCE_LOCAL_GATE) next.localGate = process.env.PHARM_EVIDENCE_LOCAL_GATE
if (process.env.PHARM_EVIDENCE_LIVE_GATE) next.liveGate = process.env.PHARM_EVIDENCE_LIVE_GATE
if (process.env.PHARM_EVIDENCE_RELEASE) next.release = process.env.PHARM_EVIDENCE_RELEASE

writeFileSync(previousPath, `${JSON.stringify(next, null, 2)}\n`)
console.log(`[write-pharm-green-evidence] commit=${sha} release=${next.release}`)
