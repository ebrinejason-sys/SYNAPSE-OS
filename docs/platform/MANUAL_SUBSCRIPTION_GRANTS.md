# Manual Subscription Grants

Manual grants are platform-admin entitlement overrides. They do not mark a payment as successful and do not mutate `tenant_subscriptions` or `subscription_payments`.

## Source of truth

Normal paid access remains in `tenant_subscriptions`, backed by `subscription_plans`, `subscription_payments`, and the existing entitlement policy. Manual access is stored separately in `subscription_grants` and resolved by `resolveEffectiveSubscription` in `packages/auth/src/billing/entitlement.ts`.

## Resolution rules

1. An active, unrevoked grant covering the current time provides `MANUAL_GRANT` access and reports `paymentStatus: NOT_REQUIRED`.
2. A future grant is `SCHEDULED`; an expired or revoked grant is ineffective.
3. Without an active grant, the existing paid/trial/grace policy remains authoritative.
4. Revoking a grant never changes a paid subscription or payment ledger.
5. Tenant-level grants are the supported production scope for facility, pharmacy, laboratory, clinic, hospital, and organization access. User grants are stored for future user-level products and do not automatically change tenant access.

## API

Platform Admins with `platform.subscription.manage` use `/api/platform/subscription-grants`:

- `GET` lists grants, optionally filtered by `tenant_id`.
- `POST` creates a grant. Dates are validated server-side; `idempotency_key` makes retries safe.
- `PATCH` with `action=revoke` revokes immediately.
- `PATCH` with `action=extend` or `action=shorten` changes only the expiry after a required reason.

All mutations write `audit_log` events. Reasons and old/new values are retained. Payment status remains separate and is displayed as `NOT_REQUIRED` for manual access.

## Security

The migration enables RLS. Tenant users can read grants scoped to their tenant; only platform-admin access can write. API authorization is capability-based and facility admins cannot create platform grants.

Live migration application and production proof require the Supabase CLI, target project credentials, and an explicitly synthetic tenant.
