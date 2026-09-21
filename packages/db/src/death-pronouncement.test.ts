import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertCanPronounce,
  certifyCauseOfDeath,
  createDeathPronouncement,
  deathTimelineEvents,
  deceasedDisposition,
  publicMortuaryQrPayload,
  recordNextOfKinNotification,
} from "./death-pronouncement.ts"

const base = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  facilityId: "22222222-2222-4222-8222-222222222222",
  patientId: "33333333-3333-4333-8333-333333333333",
  encounterId: "44444444-4444-4444-8444-444444444444",
  pronouncedBy: "55555555-5555-4555-8555-555555555555",
  locationType: "ward" as const,
}

describe("death pronouncement domain", () => {
  it("accepts unknown time of death without fabricating a clock time", () => {
    const record = createDeathPronouncement({
      ...base,
      deathTimePrecision: "UNKNOWN",
      deathTimeText: "date known, exact time unknown",
    })
    assert.equal(record.deathTimePrecision, "UNKNOWN")
    assert.equal(record.deathDateTime, null)
    assert.match(record.deathTimeText ?? "", /unknown/)
  })

  it("requires a timezone-aware stamp for exact time", () => {
    assert.throws(
      () => createDeathPronouncement({ ...base, deathTimePrecision: "EXACT", deathDateTime: "2026-09-21 03:42" }),
      /DEATH_TIME_EXACT_REQUIRES_TIMEZONE/,
    )
    const record = createDeathPronouncement({
      ...base,
      deathTimePrecision: "EXACT",
      deathDateTime: "2026-09-21T03:42:00+03:00",
    })
    assert.equal(record.status, "pronounced")
  })

  it("keeps certification behind a separate capability", () => {
    const pronounced = createDeathPronouncement({
      ...base,
      deathTimePrecision: "ESTIMATED",
      deathTimeText: "approximately 03:30",
    })
    assert.throws(
      () => certifyCauseOfDeath(pronounced, { certifiedBy: base.pronouncedBy, hasCertifyCapability: false, causeOfDeath: [] }),
      /DEATH_CERTIFY_FORBIDDEN/,
    )
    const certified = certifyCauseOfDeath(pronounced, {
      certifiedBy: "66666666-6666-4666-8666-666666666666",
      hasCertifyCapability: true,
      causeOfDeath: [
        { sequence: 1, role: "immediate", narrative: "Hypoxaemic respiratory failure", clinicianConfirmed: true, icd11Code: "CB41" },
        { sequence: 2, role: "underlying", narrative: "Community-acquired pneumonia", clinicianConfirmed: true, icd11Code: "CA40" },
      ],
    })
    assert.equal(certified.status, "certified")
    assert.equal(certified.certifiedBy, "66666666-6666-4666-8666-666666666666")
  })

  it("binds deceased disposition to the pronouncement and keeps timeline free of cause narrative", () => {
    const record = createDeathPronouncement({
      ...base,
      deathTimePrecision: "EXACT",
      deathDateTime: "2026-09-21T03:42:00+03:00",
      provisionalCause: "sensitive cause narrative",
    })
    const notified = recordNextOfKinNotification(record, { notified: true, relationship: "spouse", actorId: base.pronouncedBy })
    const events = deathTimelineEvents(notified)
    assert.equal(deceasedDisposition(record.id).disposition, "DECEASED")
    assert.equal(events.some((event) => event.title === "Death pronounced"), true)
    assert.equal(events.some((event) => /sensitive cause/.test(event.summary)), false)
    assert.deepEqual(publicMortuaryQrPayload("MB-1"), { bodyNumber: "MB-1", kind: "mortuary_tag" })
  })

  it("denies pronouncement without permission", () => {
    assert.throws(() => assertCanPronounce(false), /DEATH_PRONOUNCE_FORBIDDEN/)
  })
})
