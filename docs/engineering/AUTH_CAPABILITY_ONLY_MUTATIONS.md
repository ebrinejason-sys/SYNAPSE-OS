# Auth Capability-Only Mutations Policy

## Overview

As of Wave 2 (SYNAPSE-OS), all **mutating** API routes and server actions MUST authorize via the capability lattice (`requireCapability`, `requirePharmacyPermission`, RLS `has_capability`) rather than coarse `profiles.is_admin` / `isAdmin` checks.

## What Changed

### Before Wave 2
Some routes checked `profile.is_admin` or `session.isAdmin` as a shortcut to grant mutation access:
```typescript
if (!ADMIN_ROLES.has(role) && !profile.is_admin) {
  return forbidden()
}
```

### After Wave 2
All mutation gates now use the capability lattice exclusively:
```typescript
if (!ADMIN_ROLES.has(role)) {
  return forbidden()
}
```

For hospital routes:
```typescript
const cap = await requireHospitalCapability(ctx, 'staff', 'write')
if (cap) return cap
```

For pharmacy routes:
```typescript
const auth = await requirePharmacyPermission('pos.discount_override')
if (!auth.ok) return auth.response
```

## What `is_admin` Still Means

The `is_admin` profile field remains in the schema for specific, non-mutation purposes:

1. **UI Hints**: Client components may read `isAdmin` to conditionally render admin-only UI elements (e.g., showing an "Admin Panel" link)
2. **Profile Serialization**: API routes like `/api/auth/me` return `isAdmin` as part of the user profile DTO
3. **Platform Operations**: Platform operators (`platform_admin`, `superadmin` roles) may be marked `is_admin=true` to indicate cross-tenant capabilities
4. **Notification Targeting**: Read-only queries (e.g., billing sweep email recipients) may use `.or('is_admin.eq.true,role.eq.pharmacy_admin')` to find admins

## What `is_admin` Must NOT Mean

1. **Mutation Authorization**: Never check `is_admin` alone to allow a mutation (create, update, delete operations)
2. **Capability Bypass**: Never use `if (isAdmin) return true` to skip capability checks
3. **RLS Bypass**: Never use `is_admin` in RLS policies to grant write access

## Enforcement

### Code Review
All PRs touching authorization must:
- Use `requireCapability` / `requirePharmacyPermission` for mutations
- Never introduce new `is_admin` mutation gates
- Document any intentional `is_admin` reads with a comment explaining why

### Testing
Tests must prove:
- ✅ A user with the proper capability **without** `is_admin=true` succeeds
- ❌ A user with `is_admin=true` **without** the proper capability fails (403)
- ❌ A user with neither fails (403)

See `apps/pharmacy/app/api/admin/pos/supervisor-approve/route.test.ts` for an example.

## Affected Files (Wave 2 Changes)

### Fixed Mutation Gates
1. **`apps/web/src/lib/hospital-admin/context.ts`**
   - Removed `&& !profile.is_admin` from role check (line 47)
   - Now requires role in `ADMIN_ROLES` set (`hospital_admin`, `platform_admin`, `admin`)

2. **`apps/pharmacy/app/api/admin/pos/supervisor-approve/route.ts`**
   - Removed `profile.is_admin === true` check (line 54)
   - Now requires `roleHasCapability(role, "pos.discount_override")` OR `role === "pharmacy_admin"`

3. **`apps/pharmacy/app/api/billing/subscribe/route.ts`**
   - Removed redundant `!session.isAdmin && session.role !== 'pharmacy_admin'` check (line 11)
   - Already gated by `requirePharmacyAdmin()` which validates role

4. **`apps/web/src/app/api/billing/subscribe/route.ts`**
   - Removed `!ctx.user.isAdmin &&` from role check (line 10)
   - Now requires `role === 'hospital_admin' || role === 'pharmacy_admin'`

### Unchanged (Intentional)
- **Profile DTOs**: `/api/auth/me`, `/api/auth/mobile/me`, `/api/auth/mobile/otp-verify` still return `isAdmin` field
- **Billing sweep**: `/api/cron/billing-sweep` uses `.or('is_admin.eq.true,role.eq.pharmacy_admin')` to find email recipients (read-only)
- **Middleware**: `apps/pharmacy/middleware.ts` uses `is_admin` for tenant access gates (not mutation authorization)
- **Provision actions**: `apps/web/src/app/platform/tenants/provision/actions.ts` sets `is_admin: true` on profile creation (already gated by `requirePlatformAdmin()`)

## Capability Matrix References

### Hospital Capabilities
Defined via RPC `has_capability` in `packages/auth/src/capability.ts`:
- Modules: `config`, `opd`, `billing`, `lab`, etc.
- Resources: `staff`, `settings`, `encounter`, `invoice`, etc.
- Actions: `read`, `write`, `create`, `sign`, etc.

Platform operators (`platform_admin`, `superadmin`) bypass non-hospital checks.

### Pharmacy Capabilities
Defined in `packages/auth/src/pharmacy-capabilities.ts`:
- `pos.sell`, `pos.discount_override`, `pos.refund`
- `inventory.read`, `inventory.write`, `inventory.adjust`
- `purchasing.manage`, `rx.verify`, `rx.dispense`
- `customers.credit`, `reports.operational`, `reports.financial`
- `staff.manage`, `settings.manage`, `audit.read`

Roles: `pharmacy_cashier`, `pharmacist`, `inventory_officer`, `pharmacy_store_manager`, `finance`, `pharmacy_admin`, `pharmacy_ceo`

## Migration Checklist for New Routes

When adding a new mutating API route or server action:

1. ✅ Use `requireHospitalCapability(ctx, resource, action, module)` for hospital routes
2. ✅ Use `requirePharmacyPermission(capability)` for pharmacy routes
3. ✅ Use `requireCapability(payload, module, resource, action)` for generic server actions
4. ❌ Never check `profile.is_admin` or `session.isAdmin` for mutations
5. ✅ Add tests proving capability-only authorization
6. ✅ Document any intentional `is_admin` reads in comments

## Examples

### ✅ Correct: Capability-only mutation
```typescript
export async function POST(req: NextRequest) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'staff', 'write')
  if (cap) return cap

  // Mutation logic here
}
```

### ❌ Incorrect: Using is_admin for mutations
```typescript
export async function POST(req: NextRequest) {
  const ctx = await getContext('web')
  if (!ctx.user.isAdmin && ctx.user.role !== 'hospital_admin') {
    return forbidden()
  }
  // BAD: is_admin bypass
}
```

### ✅ Correct: Role-based (roles map to capabilities)
```typescript
export async function POST(req: NextRequest) {
  const auth = await requirePharmacyAdmin()
  if (!auth.ok) return auth.response
  // requirePharmacyAdmin validates role via isPharmacyAdmin()
}
```

### ✅ Correct: Explicit capability check
```typescript
const elevated =
  roleHasCapability(role, "pos.discount_override") ||
  profile.role === "pharmacy_admin"

if (!elevated) {
  return forbidden()
}
```

## Rationale

1. **Security**: Coarse `is_admin` flags are error-prone and hard to audit
2. **Tenant Isolation**: Capability checks enforce module/resource/action granularity
3. **Auditability**: Capability logs show exactly what was permitted
4. **Future-proofing**: New roles/permissions integrate cleanly into the lattice
5. **Compliance**: Fine-grained access controls are required for healthcare data (HIPAA, GDPR)

## References

- Capability implementation: `packages/auth/src/capability.ts`
- Pharmacy capabilities: `packages/auth/src/pharmacy-capabilities.ts`
- Hospital shared guard: `apps/web/src/lib/hospital-shared/guard.ts`
- Pharmacy context: `apps/pharmacy/lib/pharmacy-context.ts`
- Wave 1 (on hold): Database migrations for capability matrix (not yet applied)
- Wave 2 inventory: `/workspace/WAVE2_INVENTORY.md`
