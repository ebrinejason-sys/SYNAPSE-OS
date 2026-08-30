import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManageTargetRole,
  canResetPasswordFor,
  isObserverRole,
  roleHasCapability,
} from "./rbac.ts";

describe("platform RBAC", () => {
  it("observers can read test center but not mutate tenants", () => {
    assert.equal(roleHasCapability("BOARD_OBSERVER", "test_center.read"), true);
    assert.equal(roleHasCapability("BOARD_OBSERVER", "tenant.manage"), false);
    assert.equal(roleHasCapability("BOARD_OBSERVER", "feature_flag.manage"), false);
  });

  it("platform admin cannot manage super admin by default", () => {
    assert.equal(canManageTargetRole("PLATFORM_ADMIN", "SUPER_ADMIN"), false);
    assert.equal(canManageTargetRole("PLATFORM_ADMIN", "BOARD_OBSERVER"), true);
    assert.equal(canManageTargetRole("SUPER_ADMIN", "SUPER_ADMIN"), true);
  });

  it("password reset respects role hierarchy", () => {
    assert.equal(canResetPasswordFor("PLATFORM_ADMIN", "BOARD_OBSERVER"), true);
    assert.equal(canResetPasswordFor("PLATFORM_ADMIN", "SUPER_ADMIN"), false);
    assert.equal(canResetPasswordFor("BOARD_OBSERVER", "BOARD_OBSERVER"), false);
  });

  it("classifies observer roles", () => {
    assert.equal(isObserverRole("INVESTOR_OBSERVER"), true);
    assert.equal(isObserverRole("PLATFORM_ADMIN"), false);
  });
});
