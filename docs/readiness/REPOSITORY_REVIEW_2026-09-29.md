# Repository review — 29 September 2026 (Africa/Kampala)

## Work completed today

The release branch contained 28 commits dated today before this review, within PR #116's 53-commit release acceptance change set:

- Auth: neutral pre-proof OTP responses and origin checks across authentication cookies.
- Tenancy: patient and pharmacy references scoped to the facility; OPD vitals and diagnosis encounters scoped to the staff hospital.
- Clinical: persisted result review, retryable audit writes, and handoff for triage already in progress.
- Lab and billing: persisted specimen rejection, closed rejected-order tasks, excluded cancelled orders/recollections from billing, and retryable charge voiding.
- Pharmacy: supervised till close, explicit sale idempotency argument, protected deletion of customers with credit history, provider email failure handling, and real purchase-order email sending.
- Accessibility/navigation: correct facility sidebar URLs, keyboard-safe drawer, labelled clinical forms, focus restoration, and light-theme contrast fixes.
- Validation: local acceptance runners for golden journey, authorization, account states, platform recovery, pharmacy, Lab, billing and browser accessibility; lint coverage and route/ACL inventories.

## Polish added during this review

Purchase-order creation previously reported SENT even if the post-email database update failed. The route now checks both the update error and returned row, reports only confirmed saved state, and warns that the email was accepted but delivery status could not be saved. The warning discourages duplicate orders and unconfirmed resends. Audit detail distinguishes this partial failure. Four regression cases cover saved status, database rejection, missing updated row, and email-provider failure.

## Remote integration audit

- #116 is the release acceptance PR. Its original head had successful CI and deployment verification; the polish requires fresh checks.
- #104's head `c68f812` has an identical Git tree to the initial main `9d437a2`. Its catalog/provisioning changes are already integrated. Its failed control-plane test used an expired fixed timestamp; #116 already uses the current time for that fixture.
- The exact tips of the following remote branches match merged PR heads whose merge commits are ancestors of main: capability-only mutations (#96), import assistant (#101), pharmacy auth validation (#99), pharmacy production readiness (#100), production migration ledger (#95), Wave 3 evidence (#97), death pathway compatibility (#98), and release acceptance closeout (#115).
- These already-integrated tips are reconciled as history-only merge parents, retaining the current release tree. This avoids replaying superseded code from squash-merged branches. No branch is deleted or force-pushed.

## Remaining follow-ups

Merging source does not establish production acceptance. The release PR records these separate rollout and product tasks:

1. Confirm production deployment SHA and run a synthetic golden journey/security/accessibility smoke.
2. Review and apply the proposed plan-feature and clinician-capability seeds through the approved database release process, then verify each production plan. Proposed SQL remains under `supabase/proposed/`.
3. Complete the intended archived-account restore and verify Platform Admin login.
4. Darken brand orange text/button combinations for contrast, make pharmacy notification rows keyboard-operable, and simplify duplicate navigation/main/skip-link landmarks.
5. Prioritize existing security debt: tenant validation of product supplier references, clinical-prescription stock authority, reception write-up/document/pathway permissions, and best-effort platform audit writes.
6. Decide supplementary-invoice/refund policy, waiver/exemption policy, and hospital OTC workflow. Add shared-package lint coverage.

The pre-existing untracked `.migration-backup/` directory is preserved locally and excluded from commits.
