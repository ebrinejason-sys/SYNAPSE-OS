# Code Review Request - Synapse Ecosystem v9.0 Functional Integration

## Changes Overview
1. **Demo Login Bypass**: Implemented hardcoded login logic in `src/pages/auth/Login.tsx` for `demodoc@synapseos.tech` (Pass: `Demo4321`) and `demopat@synapseos.tech` (Pass: `Demo1234`). Added a UI helper to fill these credentials.
2. **Theme Engine**: Created a `useTheme` hook and `ThemeToggle` component. Updated `index.css` to use CSS variables (`--synapse-black`, `--synapse-dark`, etc.) supporting a light mode fallback while maintaining the "Sovereign AI" dark aesthetic by default.
3. **Resend Email Integration**: Added `src/services/emailService.ts` to handle pilot application notifications via the Resend API. It falls back to logging if the API key is missing.
4. **Pilot Application Flow**: Updated `src/pages/marketing/PilotApply.tsx` to be a functional form with state management, email notification, and a success state.
5. **Brand Asset Integration**: Processed real logos and founder photos from `/tmp/file_attachments` into `public/assets/`. Replaced placeholders with these real assets in `LandingPage.tsx` and `SimplePage.tsx`. Created a reusable `Logo` component.
6. **Pricing Logic**: Implemented a `PricingModal` in the landing page for tiered plan selection and comparison.

## Verification Results
- `npm run build` and `npm run lint` pass.
- Playwright verification script confirmed:
  - Demo login redirection for both roles.
  - Theme toggling between dark and light modes.
  - Pilot application form submission and success state.
  - All routes resolve (SimplePage catch-all).

## Points for Review
- Ensure the CSS variable approach in `index.css` is consistent with Tailwind 4.0 patterns.
- Confirm the `Logo` component properly handles the `variant` prop for different backgrounds.
- Check if the `PricingModal` implementation in `LandingPage.tsx` is clean enough or should be extracted.
