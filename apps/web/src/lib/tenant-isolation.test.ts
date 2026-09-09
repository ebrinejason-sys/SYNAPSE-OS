import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTenantScopeAllowed } from "./tenant-scope.ts";
import { canBindInviteToTenant } from "./invite-scope.ts";

describe("tenant isolation (HOSPITAL_GAP_BACKLOG P0-004)", () => {
  it("rejects staff of tenant A from the tenant B OS shell", () => {
    assert.equal(
      isTenantScopeAllowed("tenant-a", [{ tenant_id: "tenant-a" }], "tenant-b", "doctor", "hospital"),
      false,
    );
  });

  it("rejects a profile with an active scope in another tenant", () => {
    assert.equal(
      isTenantScopeAllowed(null, [{ tenant_id: "tenant-a" }], "tenant-b", "nurse", "hospital"),
      false,
    );
  });

  it("allows only the assigned tenant and keeps hospital PHI closed to platform admins", () => {
    assert.equal(
      isTenantScopeAllowed(null, [{ tenant_id: "tenant-a" }], "tenant-a", "doctor", "hospital"),
      true,
    );
    assert.equal(
      isTenantScopeAllowed(null, [], "tenant-a", "platform_admin", "hospital"),
      false,
    );
    assert.equal(
      isTenantScopeAllowed(null, [], "tenant-a", "platform_admin", "pharmacy"),
      true,
    );
  });

  it("rejects a facility A invite from binding a profile to facility B", () => {
    assert.equal(canBindInviteToTenant(null, ["tenant-b"], "tenant-a"), false);
    assert.equal(canBindInviteToTenant("tenant-b", [], "tenant-a"), false);
    assert.equal(canBindInviteToTenant(null, ["tenant-a"], "tenant-a"), true);
  });
});