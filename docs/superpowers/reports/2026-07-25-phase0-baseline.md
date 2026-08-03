# Phase 0 baseline report — 2026-07-25

Machine: Windows 10 · Node **v24.18.0** (engines declare **22.x**) · npm 11.16.0  
Repo: `SYNPASE-OS` @ `main` (`d56f313`) + uncommitted WIP

## Check results

| Check | Result | Notes |
|---|---|---|
| `npm install` | Pass | EBADENGINE warnings (Node 24 vs 22.x) |
| `npm run db:check` | Pass | 30 migration files OK |
| `@synapse/web` type-check | Pass | After fixing `money.ts` + `mobile-alerts` null narrowing |
| `@synapse/pharmacy` type-check | Pass | |
| `@synapse/app` type-check | Fail | React 18 app vs root `@types/react` 19 / JSX component incompatibilities (Ionicons, Stack, Tabs, LinearGradient) — known monorepo types drift |
| `@synapse/pharmacy` test | Pass | 12 vitest + 3 node:test FEFO after excluding `fefo.test.ts` from vitest |
| `@synapse/pharmacy` lint | Pass | 0 errors / 326 warnings |
| `@synapse/web` lint | Pass | Migrated `next lint` → ESLint 9 flat config; 0 errors / 159 warnings. Previous `.eslintrc.json` ignored almost all of `src/**`. |
| `@synapse/pharmacy` build | Pass | After ensuring `tailwindcss` resolves for `tailwindcss-animate` |
| `@synapse/web` build | Not run this pass | Next: `npm run build --workspace @synapse/web` |
| Expo Android export | Not run | Blocked by type-check drift; schedule after `@types/react` isolation |

## Uncommitted work (protect before Phase 1)

Large WIP on `main` (~1.4k insertions) spanning:

- Platform receipts/invoices (edit, delete, money helpers, documents)
- Platform overview / broadcasts / layout
- Pharmacy `complete-sale` + inventory stock route tweaks
- Mobile push deeplinks + auth package export
- Cron mobile-alerts
- `globals.css` tweaks
- `package-lock.json` churn from install

**Action required:** branch or intentional commits before further Phase 1 work. Do not mix baseline fixes with receipts WIP without review.

Suggested split:

1. `chore/phase0-baseline` — lint migration, vitest exclude, money/mobile-alerts type fixes
2. `feat/platform-receipts` — receipts UI/API
3. `feat/mobile-push-alerts` — push deeplinks + cron
4. Pharmacy POS/inventory deltas — review whether to fold into POS atomicity sprint

## Role inventory (product)

| Role | Primary surface |
|---|---|
| Platform administrator / superadmin | `apps/web` `/platform` |
| Pharmacy owner/admin (`pharmacy_admin`, `pharmacy_ceo`) | `apps/pharmacy` portal |
| Pharmacist | Pharmacy + hospital dispensing |
| Cashier (`pharmacy_cashier`) | Pharmacy POS |
| Hospital administrator | Hospital OS admin |
| Clinician (doctor / clinical_officer) | Hospital OS OPD |
| Nurse | Hospital OS ward/IPD |
| Lab technician | Lab modules |
| Patient | Expo app + patient portal |

Canonical role constants: `packages/config/src/constants.ts` (`ALL_ROLES`, `PHARMACY_ROLES`).

## Encoding / mojibake

- Active `apps/**`: no `â€”` / `â†’` style corruption found in this scan.
- Legacy demo (`legacy/vite-demo`): multiple mojibake instances — defer unless pages are still published.

## Environment / deployment matrix (to complete)

Fill from Vercel + Supabase dashboards:

| App | Production URL | Staging URL | Project ID | Notes |
|---|---|---|---|---|
| Web (Hospital OS + marketing) | TBD | TBD | TBD | |
| Pharmacy | TBD | TBD | TBD | |
| Expo | TBD | TBD | TBD | EAS profiles needed |
| Supabase | `qfqakzmjatszisuqjwon` (from `db:link`) | TBD | — | Migration list via `supabase migration list` when linked |

Prior env inventory: `docs/superpowers/plans/build-doctrine-status.md` (partially stale).

## Release checklist (short)

1. `npm run db:check`
2. `npm run type-check --workspace @synapse/web`
3. `npm run type-check --workspace @synapse/pharmacy`
4. `npm run test --workspace @synapse/pharmacy`
5. `npm run lint --workspace @synapse/web` and `@synapse/pharmacy`
6. `npm run build` for web + pharmacy
7. Smoke: login, one POS sale (staging), one platform admin page
8. Confirm migration applied on target env
9. Tag release notes with Git SHA

## Prioritized backlog (sprint)

1. Protect WIP (branch/commit).
2. Fix pharmacy Tailwind hoist / build.
3. Pin Node 22 in local + CI (or widen engines after verification).
4. Fix Expo `@types/react` isolation.
5. Typography spec + homepage/pharmacy landing reference.
6. Disable legacy POS `transaction` route; cashier = session user; idempotency design.
7. Capability matrix implementation plan.
8. Staging + seed data.
