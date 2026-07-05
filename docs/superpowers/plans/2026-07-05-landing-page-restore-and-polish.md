# Landing Page Restore + Brand Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current minimal landing page (`apps/web/src/app/page.tsx`) with the full pre-redesign content (real logo, real theme tokens, all 15+ sections), then apply a small, targeted brand-consistency color fix so the only off-palette color on the page (a hardcoded Tailwind green) is replaced with the site's actual teal/"cyan" token.

**Architecture:** No new components or infrastructure. The entire pre-redesign component library (`LandingNav`, `LandingHero`, `TrustMarquee`, `AudiencePaths`, `SectionShell`, `FeatureTabs`, `DemoWidget`, `NewsletterForm`, `LandingFooter`, `Reveal`) already exists on disk under `apps/web/src/components/landing/`, untouched and simply unused by the current `page.tsx`. Task 1 restores the exact historical file via `git show`. Task 2 makes three scoped color edits directly in that restored file.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind (via `@synapse/config/tailwind`), CSS custom properties in `apps/web/src/app/globals.css`.

## Global Constraints

- No test infrastructure exists for `apps/web` (only a `type-check` script). Verification for every task is `npm run type-check --workspace=apps/web` plus a manual diff read-through — do not add a test framework as a side effect of this plan.
- No copy, pricing figures, module list, comparison data, or section order changes — this is a restore, not a rewrite.
- No new CSS color tokens. "Cyan" maps to the existing `--brand-teal` token (`#1FA6A6` dark theme / `#0F766E` light theme, defined in `apps/web/src/app/globals.css`) per explicit user decision — do not introduce a new cyan variable.
- Do not modify `LandingHero`, `AudiencePaths`, `TrustMarquee`, `FeatureTabs`, `DemoWidget`, `NewsletterForm`, `LandingFooter`, or any file under `apps/web/src/components/landing/` — they are already correct and out of scope.
- Never run destructive git operations (no `git reset --hard`, no force push).
- Commit after each task, following this repo's existing commit style (short imperative subject — see `git log --oneline -5` for examples).

---

### Task 1: Restore the pre-redesign landing page content

**Files:**
- Modify: `apps/web/src/app/page.tsx` (full replacement via git restore)

**Interfaces:**
- Consumes: nothing new — the restored file imports six already-existing components (`FeatureTabs`, `DemoWidget`, `NewsletterForm`, `LandingHero`, `TrustMarquee`, `AudiencePaths`, `LandingNav`, `LandingFooter`, `SectionShell`, `Reveal`), none of which are modified by this plan.
- Produces: the restored `page.tsx` is what Task 2 edits.

- [ ] **Step 1: Restore the exact pre-redesign file from git history**

Run from the repo root (`c:\Users\ebrin\SYNAPSE-OS`):

```bash
git show 2f3d2c02cbeab9b9ee4455b83928172f13760750:apps/web/src/app/page.tsx > apps/web/src/app/page.tsx
```

This is the commit immediately before the `landing-redesign-9487459855002486702` branch replaced the page — it is the last-known-good pre-redesign version (579 lines, confirmed during design).

Expected: `apps/web/src/app/page.tsx` now starts with:
```ts
import Link from 'next/link'
import Image from 'next/image'
import { FeatureTabs } from '../components/landing/FeatureTabs'
```
and ends with the `LandingFooter` closing the `HomePage` component (579 lines total).

- [ ] **Step 2: Confirm the redesign's now-orphaned code is gone**

Run: `grep -n "syn-root\|function Knot" apps/web/src/app/page.tsx`
Expected: no output (empty) — the restore in Step 1 fully replaced the file, so the redesign's `Knot` SVG component and inline `synCss` template string (both previously defined only in this file) are gone. Nothing else in the codebase references `Knot` or `synCss`, so no other files need cleanup.

- [ ] **Step 3: Type-check**

Run: `npm run type-check --workspace=apps/web`
Expected: exits 0. (The restored file only imports components that already exist unchanged on disk, so this should pass without modification.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "fix(web): restore pre-redesign landing page content, logo, and theme tokens"
```

---

**Section-rhythm audit note:** the spec called for auditing `SectionShell` variants and `landing-card`/`landing-card-elevated` hover states in `globals.css` for inconsistent spacing/borders. That audit was done during planning (`apps/web/src/app/globals.css` lines 815-891, `apps/web/src/components/landing/SectionShell.tsx`): `.landing-section` padding, `.landing-card`/`.landing-card-elevated` borders, and hover lift/shadow are already applied uniformly across every section via the shared `SectionShell` component and shared CSS classes — there is no inconsistency to fix. No task below touches `globals.css` or `SectionShell.tsx` as a result; the only real inconsistency found was the color usage fixed in Task 2.

### Task 2: Brand-consistency color polish

**Files:**
- Modify: `apps/web/src/app/page.tsx` (three edits on top of Task 1's restore)

**Interfaces:**
- Consumes: the file produced by Task 1 (must be run after Task 1).
- Produces: nothing consumed by other tasks — this is the last task in the plan.

Three spots in the restored file use hardcoded Tailwind palette colors (`green-500`, `red-400`, `amber-400`) instead of the page's own brand tokens (`--brand-teal`, `--brand-gold`, `--text-muted`). Of these, only the pharmacy product card's green is genuinely off the black/white/orange/gold/teal palette — the fix reassigns it to teal, which also completes a clean 3-way mapping across the three product cards: Hospital = orange, Pharmacy = teal, Patient app = gold. The comparison-table and pricing-checkmark greens get the same treatment for the same reason. Using the CSS variables (instead of fixed Tailwind hex values) also makes these three spots respect the light/dark theme toggle, which the hardcoded classes did not.

- [ ] **Step 1: Fix the comparison table's `CompareCell` colors**

In `apps/web/src/app/page.tsx`, find:

```ts
function CompareCell({ v }: { v: Cell }) {
  if (v === 'yes') return <span className="font-medium text-green-500">Yes</span>
  if (v === 'no') return <span className="font-medium text-red-400">No</span>
  return <span className="font-medium text-amber-400">Partial</span>
}
```

Replace with:

```ts
function CompareCell({ v }: { v: Cell }) {
  if (v === 'yes') return <span className="font-medium" style={{ color: 'var(--brand-teal)' }}>Yes</span>
  if (v === 'no') return <span className="font-medium" style={{ color: 'var(--text-muted)' }}>No</span>
  return <span className="font-medium" style={{ color: 'var(--brand-gold)' }}>Partial</span>
}
```

- [ ] **Step 2: Fix the pricing tier checkmark color**

In the same file, find (inside the `TIERS.map` block):

```tsx
                    <span className="mt-0.5 shrink-0 text-green-500">✓</span>
```

Replace with:

```tsx
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--brand-teal)' }}>✓</span>
```

- [ ] **Step 3: Recolor the Pharmacy product card from green to teal**

In the same file, find the second `<article>` inside the `id="products"` `SectionShell` (the "Synapse Pharm" card):

```tsx
          <article className="landing-card-elevated group flex flex-col p-6 transition-all hover:border-green-500/40" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <span className="text-lg font-bold text-green-500">P</span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-green-500">Pharmacies</p>
            <h3 className="font-display mb-3 text-xl font-bold">Synapse Pharm</h3>
            <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Inventory, FEFO batching, POS, supplier orders, and patient refill requests. Hosted at{' '}
              <span className="font-mono text-xs">pharm.synapseos.tech</span> or a custom domain.
            </p>
            <Link href="/apply/pharmacy" className="inline-flex items-center gap-1 text-sm font-semibold text-green-500 transition-opacity group-hover:opacity-80">
              Apply for pharmacy →
            </Link>
          </article>
```

Replace with:

```tsx
          <article className="landing-card-elevated group flex flex-col p-6 transition-all hover:border-teal-500/40" style={{ borderColor: 'rgba(31,166,166,0.2)' }}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(31,166,166,0.12)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--brand-teal)' }}>P</span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-teal)' }}>Pharmacies</p>
            <h3 className="font-display mb-3 text-xl font-bold">Synapse Pharm</h3>
            <p className="mb-5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Inventory, FEFO batching, POS, supplier orders, and patient refill requests. Hosted at{' '}
              <span className="font-mono text-xs">pharm.synapseos.tech</span> or a custom domain.
            </p>
            <Link href="/apply/pharmacy" className="inline-flex items-center gap-1 text-sm font-semibold transition-opacity group-hover:opacity-80" style={{ color: 'var(--brand-teal)' }}>
              Apply for pharmacy →
            </Link>
          </article>
```

Note: `rgba(31,166,166,*)` is the exact RGB decomposition of `--brand-teal` (`#1FA6A6`), matching the pattern already used elsewhere on this page (e.g. the hospital card's `rgba(249,115,22,*)` for `--brand-orange`).

- [ ] **Step 4: Verify no off-palette colors remain**

Run: `grep -n "text-green-500\|text-red-400\|text-amber-400\|border-green-500\|rgba(34,197,94" apps/web/src/app/page.tsx`
Expected: no output (empty).

- [ ] **Step 5: Type-check**

Run: `npm run type-check --workspace=apps/web`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "fix(web): unify landing page accent colors to brand orange/gold/teal palette"
```

---

## Post-plan verification (manual, no test suite exists)

After both tasks: run `npm run type-check --workspace=apps/web` once more from a clean state, then `npm run dev --workspace=apps/web` and load `/` in a browser. Confirm:
- The real `SynapseLogo` renders in the nav (not a generic icon), and the theme toggle switches light/dark correctly.
- All restored sections render with data: audience paths, context, 3 product cards (orange/teal/gold), deploy steps, feature tabs, 19-module grid, DHIS2 reporting, 4-tier pricing, demo widget, pilot programme, team, comparison table, standards/integrations, security/trust grid, dual CTA, newsletter form.
- No stray green/red/amber Tailwind colors are visible anywhere on the page in either theme.
