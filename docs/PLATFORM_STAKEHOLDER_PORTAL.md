# Platform Stakeholder Portal

## Purpose

Stakeholders (founders, board, investors, auditors, technical observers) monitor SYNAPSE development and production **without** dangerous mutation rights or clinical PHI.

## Observer home

`/platform/performance` — **SYNAPSE Performance**

Sections derived from live platform evidence:

- Platform health (DB, GitHub main SHA, deploy SHA)
- Product maturity (Product Registry manifest)
- Module readiness
- Integrations (OpenRouter, ICD-11, Vercel)
- Sanitized control-plane activity feed
- Quick links: Test Center, Deployments, Incidents, Registry

## Navigation

Observers see Governance + read-only sections. Mutation controls (tenant provisioning, feature flags, billing edits) require explicit capabilities server-side.

Server-side gates: `requirePlatformAccess(capability)` on every page and API.

## Invitation demo flow

```
SUPER_ADMIN → Platform Access → Invite Member
  → role = BOARD_OBSERVER
  → email with signed token
  → /platform/invite/[token]
  → set password → ACTIVE membership
  → MFA enroll (if required)
  → /platform/performance
```

## What observers cannot do

- Mutate deployments, releases, feature flags
- Create/suspend facilities
- Read patient records or clinical APIs
- View environment secrets or raw credentials
