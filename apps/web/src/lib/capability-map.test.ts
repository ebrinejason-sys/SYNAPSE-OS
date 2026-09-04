import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canDo } from "./capability-map.ts";

describe("negative hospital RBAC mirror (P0-RBAC)", () => {
  it("P0-RBAC-RECEPTIONIST-NO-LAB-VERIFY", () => {
    assert.equal(canDo("receptionist", "lab", "result", "verify"), false);
  });

  it("P0-RBAC-LAB-TECH-NO-PRESCRIBE", () => {
    assert.equal(canDo("lab_tech", "opd", "prescription", "create"), false);
  });

  it("P0-RBAC-CASHIER-NO-DIAGNOSIS-EDIT", () => {
    assert.equal(canDo("billing_officer", "opd", "encounter", "amend"), false);
  });

  it("P0-RBAC-PHARMACIST-NO-PHYSICIAN-DIAGNOSIS-AMEND", () => {
    assert.equal(canDo("pharmacist", "opd", "encounter", "amend"), false);
  });

  it("P0-RBAC-PLATFORM-ADMIN-NO-HOSPITAL-NOTES", () => {
    assert.equal(canDo("platform_admin", "clinical", "note", "read"), false);
  });
});