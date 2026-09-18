# GROK DEMO GREEN: Shared Change Requests

**Owner:** GROK Demo Green Workstream  
**Branch:** `grok/demo-ecosystem-green-2026-09-18`  
**Status:** In Progress

## Purpose
This document records all changes that touch shared infrastructure, production routes, or require coordination with other workstreams. All changes listed here MUST be documented before implementation.

## Change Request Log

### CR-001: Demo IndexedDB Store Structure
**Date:** 2026-09-18  
**Type:** Demo-only infrastructure  
**Status:** Approved

**Description:**  
Expanding demo IndexedDB stores to support full connected-care journey simulation.

**Stores to Add:**
- `queues` - Patient queue management (reception, triage, doctor, lab, pharmacy, billing)
- `clinical_notes` - Full clinical documentation (separate from encounters)
- `batches` - Pharmacy inventory batches with expiry dates
- `invoice_items` - Itemized billing entries
- `exchange_events` - Inter-facility communication events
- `notifications` - User notifications

**Migration Plan:**
1. Bump `DEMO_DB_VERSION` from 1 to 2
2. Implement upgrade handler that preserves existing data
3. Add new stores in `onupgradeneeded`
4. No impact on production systems (demo-only)

**Validation:**
- Test that existing demo data persists through version upgrade
- Verify all new stores are created correctly
- Confirm no data loss during migration

---

### CR-002: Demo Repository Method Fixes
**Date:** 2026-09-18  
**Type:** Bug fix (demo-only)  
**Status:** Approved

**Description:**  
Fix critical store mapping bugs in `browser-repository.ts`:

**Issues:**
1. `queuePatient` writes to `triage` store (should be `queues`)
2. `recordTriage` writes to `observations` store (should be `triage`)
3. `saveClinicalNote` writes to `encounters` store (should be `clinical_notes`)

**Impact:**
- Demo-only code path
- No production system impact
- No database schema changes

**Resolution:**
- Update method implementations to write to correct stores
- Add type safety to prevent future store mismatches
- Update seed data to populate correct stores

---

### CR-003: Demo RBAC Enforcement
**Date:** 2026-09-18  
**Type:** Security enhancement (demo)  
**Status:** Approved

**Description:**  
Enforce role-based access control at the repository layer, not just UI layer.

**Implementation:**
- Add `canPerformAction` checks in repository methods
- Throw errors when unauthorized actions are attempted
- Validate actor roles before state mutations

**Rules:**
- Reception cannot prescribe medications
- Nurse cannot release lab results  
- Doctor cannot dispense medications
- Pharmacist cannot alter clinical notes
- Lab technician cannot verify results (requires scientist)

**Impact:**
- Demo-only
- Demonstrates proper RBAC patterns
- No production changes required

---

### CR-004: Demo Session Management
**Date:** 2026-09-18  
**Type:** Feature enhancement (demo)  
**Status:** Approved

**Description:**  
Implement comprehensive demo session state management.

**Features:**
- Facility switching (hospital → lab → pharmacy)
- Role switching with proper context
- Scenario presets (golden path, edge cases)
- Online/offline mode simulation
- Pending sync queue visualization
- Guided progress tracking
- One-click reset with confirmation

**Storage:**
- Use sessionStorage for current session
- Use IndexedDB for persistent demo state
- Clear separation from production auth

---

## Change Request Template

```markdown
### CR-XXX: [Title]
**Date:** YYYY-MM-DD  
**Type:** [Bug fix | Feature | Security | Infrastructure]  
**Status:** [Proposed | Approved | Implemented | Blocked]

**Description:**  
[Clear description of what needs to change and why]

**Impact:**  
[Systems affected, risk level, coordination required]

**Implementation Plan:**  
1. [Step by step plan]
2. [...]

**Validation:**  
- [Test criteria]
- [Success metrics]

**Dependencies:**  
- [Other CRs, teams, or external systems]
```

## Coordination Rules

1. **Production Routes:** Any change to Hospital, Auth, or billing routes requires CR approval
2. **Supabase Migrations:** Must document in CR, get review, then implement  
3. **Shared Packages:** Must document API changes and version bumps
4. **CI/CD Workflows:** Must document and get approval before modifying

## Review Process

1. Document proposed change in this file
2. Mark as "Proposed"
3. Get verbal/async approval from team lead
4. Mark as "Approved" and proceed with implementation
5. Mark as "Implemented" when merged

## Emergency Changes

If production is broken and immediate fix is needed:
1. Fix the issue
2. Document the change retroactively
3. Mark as "Emergency - Documented Post-Fix"
4. Schedule proper review

---

**Last Updated:** 2026-09-18  
**Next Review:** When adding new shared changes
