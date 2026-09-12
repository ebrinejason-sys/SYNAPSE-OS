/**
 * Pure SHA / migration alignment helpers for platform Admin production truth.
 * No I/O — unit-tested; production-truth.ts supplies live probes.
 */

export type ShaMatchStatus = "MATCH" | "BEHIND" | "UNKNOWN"

export type ShaPairComparison = {
  status: ShaMatchStatus
  detail: string
}

export type ReleaseAlignmentStatus = "ALIGNED" | "DRIFT" | "UNKNOWN"

export type ReleaseAlignment = {
  status: ReleaseAlignmentStatus
  detail: string
  githubVsVercel: ShaPairComparison
  githubVsProcess: ShaPairComparison
  repoVsRemoteMigration: ShaPairComparison
}

export function shortSha(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 7)
}

/** True when full or abbreviated SHAs refer to the same commit. */
export function shasMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a === b || a.startsWith(b) || b.startsWith(a) || shortSha(a) === shortSha(b)
}

export function compareShas(
  leftLabel: string,
  leftSha: string | null | undefined,
  rightLabel: string,
  rightSha: string | null | undefined,
): ShaPairComparison {
  if (!leftSha || !rightSha) {
    return {
      status: "UNKNOWN",
      detail: `Need both ${leftLabel} and ${rightLabel} SHA to compare`,
    }
  }
  if (shasMatch(leftSha, rightSha)) {
    return {
      status: "MATCH",
      detail: `${leftLabel} matches ${rightLabel} (${shortSha(leftSha)})`,
    }
  }
  return {
    status: "BEHIND",
    detail: `${leftLabel} ${shortSha(leftSha)} ≠ ${rightLabel} ${shortSha(rightSha)}`,
  }
}

/**
 * Compare repo migration version (filename prefix) to remote ledger head.
 * Versions are timestamp strings like 20260912190100 — lexicographic order works.
 */
export function compareMigrationHeads(
  repoVersion: string | null | undefined,
  remoteVersion: string | null | undefined,
): ShaPairComparison {
  if (!repoVersion || !remoteVersion) {
    return {
      status: "UNKNOWN",
      detail: "Need both repo migration head and remote ledger head",
    }
  }
  if (repoVersion === remoteVersion) {
    return {
      status: "MATCH",
      detail: `Repo and remote migration head match (${repoVersion})`,
    }
  }
  if (repoVersion > remoteVersion) {
    return {
      status: "BEHIND",
      detail: `Remote ${remoteVersion} behind repo ${repoVersion}`,
    }
  }
  return {
    status: "BEHIND",
    detail: `Repo ${repoVersion} behind remote ${remoteVersion}`,
  }
}

export function buildReleaseAlignment(input: {
  githubSha: string | null
  vercelSha: string | null
  processSha: string | null
  repoMigrationVersion: string | null
  remoteMigrationVersion: string | null
}): ReleaseAlignment {
  const githubVsVercel = compareShas("GitHub main", input.githubSha, "Vercel production", input.vercelSha)
  const githubVsProcess = compareShas("GitHub main", input.githubSha, "process", input.processSha)
  const repoVsRemoteMigration = compareMigrationHeads(
    input.repoMigrationVersion,
    input.remoteMigrationVersion,
  )

  const pairs = [githubVsVercel, githubVsProcess, repoVsRemoteMigration]
  if (pairs.some((p) => p.status === "BEHIND")) {
    const behind = pairs.filter((p) => p.status === "BEHIND").map((p) => p.detail)
    return {
      status: "DRIFT",
      detail: behind.join(" · "),
      githubVsVercel,
      githubVsProcess,
      repoVsRemoteMigration,
    }
  }
  if (pairs.every((p) => p.status === "MATCH")) {
    return {
      status: "ALIGNED",
      detail: "GitHub main, Vercel production, process SHA, and migration ledger agree",
      githubVsVercel,
      githubVsProcess,
      repoVsRemoteMigration,
    }
  }
  return {
    status: "UNKNOWN",
    detail: "Incomplete probes — not claiming ALIGNED",
    githubVsVercel,
    githubVsProcess,
    repoVsRemoteMigration,
  }
}

/** Latest numeric-prefixed migration version from a list of filenames. */
export function repoMigrationHeadFromFiles(files: string[]): string | null {
  const versions = files
    .map((file) => {
      const base = file.split("/").pop() ?? file
      const match = base.match(/^(\d{14})(?:_|-|\.)/)
      return match ? match[1]! : null
    })
    .filter((v): v is string => Boolean(v))
    .sort()
  return versions.length ? versions[versions.length - 1]! : null
}
