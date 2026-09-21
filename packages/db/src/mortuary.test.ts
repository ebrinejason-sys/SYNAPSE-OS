import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyMortuaryTransitionCommand,
  assignMortuaryStorage,
  authorizeMortuaryRelease,
  createMortuaryBody,
  mortuaryPublicTag,
  recordMortuaryProperty,
  releaseMortuaryBody,
  transitionMortuaryBody,
} from "./mortuary.ts"

const tenantId = "11111111-1111-4111-8111-111111111111"

describe("mortuary custody", () => {
  it("identifies bodies by number and tag, not name", () => {
    const body = createMortuaryBody({
      tenantId,
      facilityId: "22222222-2222-4222-8222-222222222222",
      pronouncementId: "77777777-7777-4777-8777-777777777777",
      actorId: "staff",
      identity: { patientId: "33333333-3333-4333-8333-333333333333", synapseId: "SYN-UG-DEMO-0002" },
    })
    const tag = mortuaryPublicTag(body)
    assert.match(tag.bodyNumber, /^MB-/)
    assert.match(tag.tagCode, /^TAG-/)
    assert.equal("name" in tag, false)
  })

  it("walks the custody chain and rejects duplicate transitions", () => {
    let body = createMortuaryBody({
      tenantId,
      facilityId: "22222222-2222-4222-8222-222222222222",
      pronouncementId: "77777777-7777-4777-8777-777777777777",
      actorId: "staff",
      identity: { unknownPerson: true, temporaryIdentity: "UNK-1" },
    })
    for (const to of ["identified", "tagged"] as const) {
      body = transitionMortuaryBody(body, { to, actorId: "staff" })
    }
    body = recordMortuaryProperty(body, {
      actorId: "staff",
      items: [{ item: "Wrist watch", quantity: 1, recordedBy: "staff", witness: "nurse", sealedBagReference: "BAG-1" }],
    })
    body = transitionMortuaryBody(body, { to: "transport_requested", actorId: "staff" })
    body = transitionMortuaryBody(body, { to: "received", actorId: "attendant" })
    body = assignMortuaryStorage(body, {
      actorId: "attendant",
      occupiedSlotIds: [],
      storage: { mortuaryId: "main", slotCode: "A-12" },
    })
    assert.equal(body.status, "stored")
    assert.throws(() => transitionMortuaryBody(body, { to: "received", actorId: "attendant" }), /MORTUARY_INVALID_TRANSITION/)
  })

  it("prevents two active bodies occupying the same slot and requires release authorization", () => {
    const first = assignMortuaryStorage(
      transitionMortuaryBody(
        transitionMortuaryBody(
          recordMortuaryProperty(
            transitionMortuaryBody(
              transitionMortuaryBody(
                createMortuaryBody({
                  tenantId,
                  facilityId: "22222222-2222-4222-8222-222222222222",
                  pronouncementId: "77777777-7777-4777-8777-777777777777",
                  actorId: "staff",
                  identity: { patientId: "p1" },
                }),
                { to: "identified", actorId: "staff" },
              ),
              { to: "tagged", actorId: "staff" },
            ),
            { actorId: "staff", items: [{ item: "ID card", quantity: 1, recordedBy: "staff" }] },
          ),
          { to: "transport_requested", actorId: "staff" },
        ),
        { to: "received", actorId: "staff" },
      ),
      { actorId: "staff", occupiedSlotIds: [], storage: { mortuaryId: "main", slotCode: "A-12" } },
    )
    const second = transitionMortuaryBody(
      transitionMortuaryBody(
        recordMortuaryProperty(
          transitionMortuaryBody(
            transitionMortuaryBody(
              createMortuaryBody({
                tenantId,
                facilityId: "22222222-2222-4222-8222-222222222222",
                pronouncementId: "88888888-8888-4888-8888-888888888888",
                actorId: "staff",
                identity: { patientId: "p2" },
              }),
              { to: "identified", actorId: "staff" },
            ),
            { to: "tagged", actorId: "staff" },
          ),
          { actorId: "staff", items: [{ item: "Shoes", quantity: 1, recordedBy: "staff" }] },
        ),
        { to: "transport_requested", actorId: "staff" },
      ),
      { to: "received", actorId: "staff" },
    )
    assert.throws(
      () => assignMortuaryStorage(second, { actorId: "staff", occupiedSlotIds: ["main:A-12"], storage: { mortuaryId: "main", slotCode: "A-12" } }),
      /MORTUARY_SLOT_OCCUPIED/,
    )
    assert.throws(
      () => releaseMortuaryBody(first, { staffId: "staff", hasReleaseCapability: true }),
      /MORTUARY_RELEASE_NOT_AUTHORIZED/,
    )
    assert.throws(
      () => authorizeMortuaryRelease(first, {
        hasReleaseCapability: false,
        authorizedBy: "manager",
        recipientName: "Relative",
        recipientIdentity: "NIN-1",
        relationshipOrAuthority: "next of kin",
      }),
      /MORTUARY_RELEASE_FORBIDDEN/,
    )
    const authorized = authorizeMortuaryRelease(first, {
      hasReleaseCapability: true,
      authorizedBy: "manager",
      recipientName: "Relative",
      recipientIdentity: "NIN-1",
      relationshipOrAuthority: "next of kin",
    })
    const released = releaseMortuaryBody(authorized, { staffId: "attendant", hasReleaseCapability: true })
    assert.equal(released.status, "released")
  })

  it("does not silently duplicate a custody command", () => {
    const body = transitionMortuaryBody(
      createMortuaryBody({
        tenantId,
        facilityId: "22222222-2222-4222-8222-222222222222",
        pronouncementId: "77777777-7777-4777-8777-777777777777",
        actorId: "staff",
        identity: { patientId: "p1" },
      }),
      { to: "identified", actorId: "staff", detail: "cmd-1" },
    )
    const replay = applyMortuaryTransitionCommand({
      body,
      commandId: "cmd-1",
      appliedCommandIds: ["cmd-1"],
      to: "identified",
      actorId: "staff",
    })
    assert.equal(replay.audit.length, body.audit.length)
  })
})
