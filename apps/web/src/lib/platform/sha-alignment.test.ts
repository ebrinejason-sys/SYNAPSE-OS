import { describe, expect, it } from "vitest"
import {
  buildReleaseAlignment,
  compareMigrationHeads,
  compareShas,
  repoMigrationHeadFromFiles,
  shasMatch,
  shortSha,
} from "./sha-alignment"

describe("sha-alignment", () => {
  it("shortens SHAs", () => {
    expect(shortSha("abcdef0123456789")).toBe("abcdef0")
    expect(shortSha(null)).toBeNull()
  })

  it("matches full and abbreviated SHAs", () => {
    expect(shasMatch("abcdef0123456789", "abcdef0")).toBe(true)
    expect(shasMatch("aaaaaaaa", "bbbbbbbb")).toBe(false)
    expect(shasMatch(null, "aaaa")).toBe(false)
  })

  it("compares SHA pairs", () => {
    expect(compareShas("GitHub main", "abc1234deadbeef", "Vercel production", "abc1234").status).toBe(
      "MATCH",
    )
    expect(compareShas("GitHub main", "aaaaaaa", "Vercel production", "bbbbbbb").status).toBe("BEHIND")
    expect(compareShas("GitHub main", null, "Vercel production", "bbbbbbb").status).toBe("UNKNOWN")
  })

  it("compares migration heads", () => {
    expect(compareMigrationHeads("20260912190100", "20260912190100").status).toBe("MATCH")
    expect(compareMigrationHeads("20260912190100", "20260912184600").status).toBe("BEHIND")
    expect(compareMigrationHeads(null, "20260912190100").status).toBe("UNKNOWN")
  })

  it("picks latest repo migration version from filenames", () => {
    expect(
      repoMigrationHeadFromFiles([
        "20260912184600_encounter_disposition_columns.sql",
        "demo_schema_init.sql",
        "20260912190100_facility_referrals_lifecycle_columns.sql",
        "20260911120000_fix_invite_acceptance_verification_status.sql",
      ]),
    ).toBe("20260912190100")
  })

  it("builds ALIGNED only when every probe matches", () => {
    const aligned = buildReleaseAlignment({
      githubSha: "aaaaaaaaaaaaaaaa",
      vercelSha: "aaaaaaaaaaaaaaaa",
      processSha: "aaaaaaaa",
      repoMigrationVersion: "20260912190100",
      remoteMigrationVersion: "20260912190100",
    })
    expect(aligned.status).toBe("ALIGNED")

    const drift = buildReleaseAlignment({
      githubSha: "aaaaaaaaaaaaaaaa",
      vercelSha: "bbbbbbbbbbbbbbbb",
      processSha: "aaaaaaaa",
      repoMigrationVersion: "20260912190100",
      remoteMigrationVersion: "20260912190100",
    })
    expect(drift.status).toBe("DRIFT")

    const unknown = buildReleaseAlignment({
      githubSha: "aaaaaaaaaaaaaaaa",
      vercelSha: null,
      processSha: null,
      repoMigrationVersion: "20260912190100",
      remoteMigrationVersion: null,
    })
    expect(unknown.status).toBe("UNKNOWN")
  })
})
