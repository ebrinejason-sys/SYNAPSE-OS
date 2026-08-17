# ADR 0002 — Tenants remain facilities; organizations and sites wrap them

## Status

Accepted

## Context

Live production already keys almost every operational table by `tenants.id`. Pharmacy satellites already exist as `pharmacy_stores`. Replacing tenants with a new facility table would break POS, RLS and billing.

## Decision

Hierarchy is:

Platform → Organization → Facility (`tenants`) → Satellite/site (`pharmacy_stores` or child tenant) → Department → Staff

`facility_mode` on the tenant describes NATIVE / CONNECTED / HYBRID / SATELLITE / COMMUNITY_ACCESS without forked business logic.

## Consequences

Parent administrators aggregate by `organization_id` / `parent_tenant_id`. Branch staff are scoped with `staff_scope_assignments.site_id`. Inventory can gain `store_id` additively on batches and sales.
