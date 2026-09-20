import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { assertReleaseProvenance, shouldRunAutomaticRelease } from "./release-provenance.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const release = readFileSync(join(root, ".github/workflows/release.yml"), "utf8")
const sha = "81bc3c1fe15a9c993d0996fa316d736ed7bc51f6"

test("automatic release ignores pull_request CI completions", () => {
  assert.equal(
    shouldRunAutomaticRelease({
      conclusion: "success",
      headBranch: "cursor/final-green-report-2026-09-18",
      event: "pull_request",
    }),
    false,
  )
})

test("automatic release accepts a successful main push CI", () => {
  assert.equal(
    shouldRunAutomaticRelease({ conclusion: "success", headBranch: "main", event: "push" }),
    true,
  )
})

test("provenance still requires a main push CI run for the SHA", () => {
  const denied = assertReleaseProvenance({
    eventName: "workflow_run",
    sourceRepository: "ebrinejason-sys/SYNAPSE-OS",
    expectedRepository: "ebrinejason-sys/SYNAPSE-OS",
    sourceBranch: "main",
    sourceEvent: "push",
    sha,
    ciRuns: [{ conclusion: "success", event: "pull_request", head_branch: "main", id: 1 }],
  })
  assert.equal(denied.ok, false)
  assert.match(denied.error, /No successful required CI run/)

  const allowed = assertReleaseProvenance({
    eventName: "workflow_run",
    sourceRepository: "ebrinejason-sys/SYNAPSE-OS",
    expectedRepository: "ebrinejason-sys/SYNAPSE-OS",
    sourceBranch: "main",
    sourceEvent: "push",
    sha,
    ciRuns: [{ conclusion: "success", event: "push", head_branch: "main", id: 35347838329 }],
  })
  assert.equal(allowed.ok, true)
  assert.equal(allowed.ciRunId, 35347838329)
})

test("release workflow skips non-main workflow_run jobs instead of failing them", () => {
  assert.match(release, /github\.event\.workflow_run\.head_branch == 'main'/)
  assert.match(release, /github\.event\.workflow_run\.event == 'push'/)
  assert.match(release, /Automatic release requires a successful CI push on main/)
})
