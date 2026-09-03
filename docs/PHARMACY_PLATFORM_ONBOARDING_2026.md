# Pharmacy Platform Onboarding (2026)

## Goal

Standalone Pharmacy remains a first-class product (POS, FEFO, inventory, dispensing, stores) while onboarding moves onto the durable facility provisioning model.

## Flow

1. Platform Admin → Create Facility → Pharmacy (or `/platform/pharmacies/onboard`)
2. `provisionFacility(..., facilityType: "pharmacy")`
3. Steps: validate → core_tenant → facility_profile → modules → subscription → store → administrator → invitation → domain → finalize
4. Secure invite email (setup link) — **no temporary password email**
5. Pharmacy Admin opens invite → sets password → logs in at `pharm.synapseos.tech/login?tenant=…`

## Tenant shape

- `facility_type = pharmacy`
- `pharmacy_profiles` row
- `feature_flags` for pharmacy capabilities
- `tenant_subscriptions` trial/active
- main `pharmacy_stores` row
- `pharmacy_user_settings` for admin
- `facility_invitations` for secure onboarding

## What was removed

Platform pharmacy API no longer:

- generates/emails a reusable temp password
- silently `catch {}` failures

## What was preserved

POS, inventory, FEFO, dispensing, receipts, stores, pharmacy network APIs — not rebuilt.
