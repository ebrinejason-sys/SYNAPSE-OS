# Landing Page: Restore Pre-Redesign Content + Brand Polish

## Problem

The most recent landing page redesign (`apps/web/src/app/page.tsx`) replaced the full, content-rich
marketing page with a minimal 7-section page. In doing so it:

- Dropped the real logo (`SynapseLogo`) in favor of a generic inline SVG ("Knot" icon).
- Introduced its own standalone color palette (`--syn-teal`, `--syn-copper`, etc.) via an inline
  `<style>` block instead of the site's actual theme tokens (`--brand-orange`, `--brand-gold`,
  `--brand-teal`) and dropped light/dark theme support (`ThemeToggle`).
- Removed most of the page's content: audience paths, context section, 3-product breakdown, deploy
  steps, feature tabs, 19-module grid, DHIS2 reporting section, 4-tier pricing, live demo widget,
  pilot programme section, team section, comparison table vs OpenMRS/Slade360/paper, standards &
  integrations, security/trust grid, dual CTA cards, and the newsletter signup.

None of that content is gone for good — the entire pre-redesign component library
(`LandingNav`, `LandingHero`, `TrustMarquee`, `AudiencePaths`, `SectionShell`, `FeatureTabs`,
`DemoWidget`, `NewsletterForm`, `LandingFooter`, `Reveal`) is still present on disk under
`apps/web/src/components/landing/`, simply unused by the current `page.tsx`.

## Goal

Restore the pre-redesign landing page content and structure (using our real logo and theme colors,
which that version already wired up correctly), then apply a moderate, targeted visual-consistency
pass — not a rewrite.

## Non-goals

- No new sections, no content rewrites, no copy changes, no pricing changes.
- No new color tokens — "cyan" maps to the existing `--brand-teal` token, per user confirmation.
- No rework of `LandingHero`'s animation/structure — it's already well-built (framer-motion,
  animated counters, glow effects) and out of scope.

## Design

### 1. Restore content (revert, not rebuild)

Replace the current `apps/web/src/app/page.tsx` with the pre-redesign version (last present at
commit `2f3d2c0`, before the `landing-redesign-9487459855002486702` branch replaced it). This
version already imports and uses:

- `LandingNav` — real `SynapseLogo`, theme toggle, brand-token nav links.
- `TrustMarquee`, `LandingHero`, `AudiencePaths`
- `SectionShell`-wrapped sections for: context, products (3-card), deploy steps, feature tabs
  (`FeatureTabs`), module grid (19 department modules), DHIS2 reporting, pricing (4 tiers), demo
  widget (`DemoWidget`), pilot programme, team, comparison table, standards/integrations,
  security/trust grid.
- Dual CTA cards (hospital / patient app) and `NewsletterForm`.
- `LandingFooter`.

Delete the redesign's now-unused `Knot` SVG component and inline `synCss` template string (both
defined in the current `page.tsx` and not referenced anywhere else).

### 2. Brand-consistency polish pass (scoped)

On top of the restored content, fix spots where the pre-redesign page used generic/hardcoded colors
instead of the site's actual brand tokens, so the whole page reads as one consistent
black/white/orange/gold/teal system:

- **Comparison table (`CompareCell`)**: currently hardcodes `text-green-500` / `text-red-400` /
  `text-amber-400` for Yes/No/Partial. Replace with brand-token-driven colors (teal for Yes, a muted
  neutral for No, gold for Partial) so it matches the rest of the page instead of introducing
  off-brand Tailwind greens/reds.
- **Pricing checkmarks**: currently `text-green-500` — switch to teal or gold to match the rest of
  the pricing card's accent treatment.
- **Section rhythm**: do a pass over `SectionShell` variants and `landing-card`/`landing-card-elevated`
  hover states in `globals.css` to confirm consistent spacing/border treatment across sections —
  tighten anything that looks like a default/unstyled gap, without restructuring the components.

### 3. What stays untouched

- All copy, section order, pricing figures (`TIERS`), module list (`MODULES`), comparison data
  (`COMPARE_ROWS`), standards list (`STANDARDS`), trust/security list (`TRUST`), team bios.
- `LandingHero`, `AudiencePaths`, `TrustMarquee`, `FeatureTabs`, `DemoWidget`, `NewsletterForm`,
  `LandingFooter` internals — no changes to these components' own code, only (if needed) the shared
  CSS classes they consume from `globals.css`.

## Testing / verification

No test infrastructure exists for `apps/web` (type-check only, per existing project convention).
Verification is:

1. `npm run type-check --workspace=apps/web` — exits 0.
2. Manual visual check: run `npm run dev --workspace=apps/web`, load `/` in both light and dark
   theme, confirm logo renders, all restored sections render with real data (module grid, pricing,
   comparison table, demo widget), and the color-token fixes render as intended (no stray
   Tailwind green/red/amber).
