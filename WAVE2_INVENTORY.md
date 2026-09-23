# Wave 2: Auth Capability-Only Mutations - Inventory

## Current `is_admin` / `isAdmin` Usage

### 1. Hospital Admin Context (`apps/web/src/lib/hospital-admin/context.ts`)
**Line 47**: `if (!ADMIN_ROLES.has(role) && !profile.is_admin)`
- **Type**: Coarse authorization gate
- **Action**: Replace with capability lattice; remove `is_admin` check
- **Scope**: Hospital admin context initialization

### 2. Billing Sweep (`apps/web/src/app/api/cron/billing-sweep/route.ts`)
**Line 40**: `.or('is_admin.eq.true,role.eq.pharmacy_admin')`
- **Type**: Query for tenant admins (email recipients)
- **Action**: Keep as-is (not a mutation gate; used for finding notification recipients)
- **Scope**: Read-only admin lookup

### 3. Pharmacy Billing Subscribe (`apps/pharmacy/app/api/billing/subscribe/route.ts`)
**Line 11**: `if (!session.isAdmin && session.role !== 'pharmacy_admin')`
- **Type**: Redundant check after `requirePharmacyAdmin()`
- **Action**: Remove redundant `isAdmin` check; `requirePharmacyAdmin` already validates via `isPharmacyAdmin` which includes role checks
- **Scope**: POST mutation

### 4. Web Billing Subscribe (`apps/web/src/app/api/billing/subscribe/route.ts`)
**Line 10**: `if (!ctx.user.isAdmin && ctx.user.role !== 'hospital_admin' && ctx.user.role !== 'pharmacy_admin')`
- **Type**: Coarse mutation gate
- **Action**: Replace with `requireCapability` for billing subscription management
- **Scope**: POST mutation

### 5. Supervisor Approve (`apps/pharmacy/app/api/admin/pos/supervisor-approve/route.ts`)
**Line 54**: `profile.is_admin === true`
- **Type**: Fallback authorization for supervisor approval
- **Action**: Remove `is_admin` check; rely solely on `roleHasCapability(role, "pos.discount_override")`
- **Scope**: POST mutation (password verification for discount approval)

### 6. Pharmacy Middleware (`apps/pharmacy/middleware.ts`)
**Line 267, 271**: `profile.is_admin` checks
- **Type**: Tenant access gates (not mutation)
- **Action**: Keep as-is (middleware gates, not mutation authorization)
- **Scope**: Access control

### 7. Tenant Provision (`apps/web/src/app/platform/tenants/provision/actions.ts`)
**Line 106, 185, 199**: Setting `is_admin: true` on profile creation
- **Type**: Profile field assignment (not authorization)
- **Action**: Keep as-is (sets initial admin status for new tenants)
- **Scope**: Server action (already gated by `requirePlatformAdmin()`)

### 8. Subscription Billing (`packages/auth/src/billing/subscription.ts`)
**Line 477**: `.or('is_admin.eq.true,role.eq.pharmacy_admin')`
- **Type**: Query for billing contact (email recipient)
- **Action**: Keep as-is (read-only lookup for notification)
- **Scope**: Read-only admin lookup

### 9. Profile DTOs (Read-only serialization)
Files returning `isAdmin` as profile fields:
- `apps/web/src/app/api/auth/me/route.ts` (line 61)
- `apps/web/src/app/api/auth/mobile/me/route.ts` (line 78)
- `apps/web/src/app/api/auth/mobile/otp-verify/route.ts` (line 97)
- `packages/auth/src/context.server.ts` (line 99)

**Action**: Keep as-is (pure profile serialization for UI hints, not authorization gates)

## Mutation Routes Requiring Capability Gates

### Hospital Admin Routes (all in `apps/web/src/app/api/hospital/admin/`)
All these routes use `requireHospitalAdminContext()` which has the coarse `is_admin` check.

**Files**:
- `settings/route.ts` - PATCH/GET
- `staff/route.ts` - GET
- `staff/invite/route.ts` - POST
- `staff/[id]/route.ts` - PATCH/DELETE
- `departments/route.ts` - GET/POST
- `departments/[id]/route.ts` - PATCH/DELETE
- `services/route.ts` - GET/POST
- `services/[id]/route.ts` - PATCH/DELETE
- `wards/route.ts` - GET/POST
- `wards/[id]/route.ts` - PATCH/DELETE
- `beds/route.ts` - GET/POST
- `beds/[id]/route.ts` - PATCH/DELETE
- `modules/route.ts` - PATCH
- `audit/route.ts` - GET (read-only but admin-gated)

**Action**: All already use `requireHospitalCapability` after context; verify no additional `is_admin` checks exist

## Summary

### Keep As-Is (Not Mutation Gates)
1. **Profile DTOs** - Pure serialization for UI
2. **Billing sweep admin lookup** - Read-only query for email recipients
3. **Subscription billing contact** - Read-only query for notifications
4. **Middleware tenant access** - Access control, not mutation authorization
5. **Provision actions** - Already gated by `requirePlatformAdmin()`, setting initial profile fields

### Must Fix (Mutation Gates)
1. **`apps/web/src/lib/hospital-admin/context.ts:47`** - Remove `profile.is_admin` from `requireHospitalAdminContext()`
2. **`apps/pharmacy/app/api/billing/subscribe/route.ts:11`** - Remove redundant `isAdmin` check
3. **`apps/web/src/app/api/billing/subscribe/route.ts:10`** - Replace with capability check
4. **`apps/pharmacy/app/api/admin/pos/supervisor-approve/route.ts:54`** - Remove `profile.is_admin` check

### New Capabilities Needed
- `billing.subscribe` - For subscription management (if not already in hospital/pharmacy capabilities)
- Hospital routes already use proper capability checks via `requireHospitalCapability`
- Pharmacy routes use proper permission checks via `requirePharmacyPermission`

## Testing Strategy
1. Test that `is_admin=true` WITHOUT proper capability/role FAILS mutation (403)
2. Test that proper capability/role WITHOUT `is_admin=true` SUCCEEDS
3. Test that missing both FAILS (403)
4. Verify existing hospital capability tests still pass
5. Add pharmacy supervisor-approve test without is_admin
