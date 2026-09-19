/**
 * Pure release eligibility. Automatic Release must follow a successful CI
 * push on main — not a pull_request workflow_run.
 */
export function shouldRunAutomaticRelease({ conclusion, headBranch, event }) {
  return conclusion === "success" && headBranch === "main" && event === "push"
}

export function assertReleaseProvenance({
  eventName,
  sourceRepository,
  expectedRepository,
  sourceBranch,
  sourceEvent,
  sha,
  ciRuns,
}) {
  if (!/^[0-9a-f]{40}$/i.test(String(sha || ""))) {
    return { ok: false, error: `Invalid release SHA: ${sha}` }
  }
  if (sourceRepository !== expectedRepository) {
    return { ok: false, error: "Release source repository is not this repository" }
  }
  if (eventName === "workflow_run" && (sourceBranch !== "main" || sourceEvent !== "push")) {
    return { ok: false, error: "Automatic release requires a successful CI push on main" }
  }
  const passing = (ciRuns || []).find(
    (run) => run.conclusion === "success" && run.event === "push" && run.head_branch === "main",
  )
  if (!passing) {
    return { ok: false, error: `No successful required CI run found for ${sha}` }
  }
  return { ok: true, ciRunId: passing.id ?? null }
}
