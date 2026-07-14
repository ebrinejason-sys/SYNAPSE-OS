# Landing polish + Clinical demo wizard + Mobile gap-fixes — Design Spec

**Date:** 2026-07-13  
**Approach:** Surgical web pass → existing mobile gap-fixes plan  
**Approved by user:** proceed / implement and execute

## Goals

1. Landing page: keep structure and brand; fix overflow/clipping so copy fits all devices.
2. Clinical AI demo (`demo.synapseos.tech`): 4-step wizard collecting richer case details before differentials.
3. Expo app: execute existing `docs/superpowers/plans/2026-07-04-mobile-app-gap-fixes.md` after web.

## Landing

- Remove forced `&nbsp;` in hero title.
- Soften hero `overflow: hidden` so text is not clipped; keep decorative overflow contained on bg layers.
- Add overflow-wrap / responsive clamp on hero title and leads.
- Relax timeline `max-width: 22ch` on smaller viewports.
- No new sections, no brand/color redesign, no content rewrite.

## Clinical demo wizard

Steps: (1) Complaint + duration → (2) Age/sex/pregnancy → (3) History/allergies/meds/risk notes → (4) Vitals → Generate.

API accepts optional `duration`, `pregnancy`, `pastHistory`, `allergies`, `medications`, `riskNotes` and folds into prompt. Backward compatible. Landing `DemoWidget` unchanged.

## Mobile

No new mobile product scope — finish wiring per `2026-07-04-mobile-app-gap-fixes.md`.

## Out of scope

Hospital department builds, lead-gen form expansion, landing DemoWidget redesign, AI provider order changes.
