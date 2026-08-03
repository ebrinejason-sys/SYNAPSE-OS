# Typography system — 2026-07-25 (unified)

Applies identically to **synapseos.tech** and **pharm.synapseos.tech**.

## Brand fonts

| Role | Family | CSS / Tailwind |
|---|---|---|
| Body + UI | IBM Plex Sans | `--font-sans` / `font-sans` |
| Headings / display | IBM Plex Sans (weight 600) | `--font-display` / `font-display` |
| Data / receipts | IBM Plex Mono | `--font-mono` / `font-mono` |

Loaded via `next/font` in both app root layouts. Shared CSS: `@synapse/config/typography.css`. Shared Tailwind tokens: `@synapse/config/tailwind`.

**Why this pair:** One institutional family across marketing and product. Clear hierarchy without a playful display face. Mono stays for receipt numbers and IDs only.

## Semantic scale

Prefer tokens over arbitrary sizes (`text-[53px]`, `text-3xl`, etc.).

| Token | Use |
|---|---|
| `text-display-xl` / `text-display-l` | Landing heroes |
| `text-heading-1` … `text-heading-4` | Section and card titles |
| `text-lead` | Supporting paragraph under a heading |
| `text-body` / `text-body-lg` / `text-body-sm` | Prose |
| `text-overline` / `.type-overline` | Section labels |
| `text-mono-value` | Aligned figures |

## Components (web)

`Eyebrow`, `DisplayHeading`, `SectionHeading`, `LeadText`, `BodyText`, `MetricValue`, `TextLink` in `apps/web/src/components/typography/`. Pharmacy marketing pages use the same CSS tokens until components are moved to a shared package.

## Accessibility

- Readable at 320px and 200% zoom  
- Contrast AA for body and CTAs  
- Correct heading order; no text-in-image for critical copy  
