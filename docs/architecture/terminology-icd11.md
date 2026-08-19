# Terminology / ICD-11

Owner: **Terminology agent**. Clinical Journey consumes codes; it does not own the cache.

Status: **PLANNED**. No browser or Expo bundle may contain WHO credentials.

SYNAPSE may pursue WHO SMART-guideline *compatibility*. It must not claim WHO endorsement.

## Why a server cache

The new-encounter copilot already emits `icd11_code` strings from a model. That is not a terminology service. Production diagnosis requires:

- a versioned ICD-11 release
- entity URIs
- display terms + language
- offline/Edge snapshots of a bounded subset
- audit of which release coded a Condition

## Architecture

```text
WHO ICD-11 API (server-only credentials)
    → terminology cache (release id, entity id, URI, title, parents)
    → Core Condition.code / codeSystem = "ICD-11"
    → Edge/offline pack (signed snapshot, not live WHO calls)
```

Abstraction: feature code talks to `@synapse` terminology APIs, never to WHO from the client. Country packs (Uganda first) bind language, required modifiers, and national subsets later — do not hardcode Uganda-only codes into Core types.

## Non-negotiables

1. Credentials live in server env / Edge, never `NEXT_PUBLIC_*` or Expo extras.
2. Cached releases are immutable; recoding is an explicit Condition amendment, not a silent rewrite.
3. Self-reported or model-suggested codes remain `verificationStatus: unconfirmed` until a clinician confirms (clinical-safety).
4. Public-health indicators (`IndicatorDefinition`) bind to coded events after this cache exists. DHIS2 must not invent a parallel code list.

## Out of scope until Core opens schema

New terminology tables require the database owner (ADR 0005). This document does not add SQL.
