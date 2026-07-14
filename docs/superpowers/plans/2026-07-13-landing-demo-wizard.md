# Landing polish + Clinical demo wizard Implementation Plan

> **For agentic workers:** Execute web tasks here first, then `docs/superpowers/plans/2026-07-04-mobile-app-gap-fixes.md`.

**Goal:** Fix landing overflow/clipping; replace clinical demo single form with a 4-step wizard and richer differential API context.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind, existing demo page styles.

## File map

| File | Role |
|------|------|
| `apps/web/src/components/landing/LandingHero.tsx` | Remove `&nbsp;` |
| `apps/web/src/app/globals.css` | Overflow / wrap / timeline width |
| `apps/web/src/app/demo/page.tsx` | 4-step wizard UI |
| `apps/web/src/app/api/demo/differential/route.ts` | Accept + prompt new fields |

## Task 1: Landing responsive fixes

- [ ] Remove hero `&nbsp;`
- [ ] CSS: overflow-wrap on title; contain overflow on bg only; timeline max-width responsive
- [ ] Verify type-check `@synapse/web`

## Task 2: Demo API richer context

- [ ] Extend POST body + CLINICAL_PROMPT with duration, pregnancy, pastHistory, allergies, medications, riskNotes
- [ ] Keep backward compatibility

## Task 3: Demo wizard UI

- [ ] 4-step wizard with progress, Back/Next, Generate on step 4
- [ ] Load example fills all steps
- [ ] Mobile-friendly stack; keep results panel

## Task 4: Mobile gap-fixes

- [ ] Execute `2026-07-04-mobile-app-gap-fixes.md` task-by-task
