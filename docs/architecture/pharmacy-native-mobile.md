# Synapse Pharm — Fully-Native Expo Design (Phases 2 & 3)

Goal: the pharmacy app performs the **entire** normal pharmacy workflow natively, without
opening `pharm.synapseos.tech`. Source facts from the audit (Expo SDK 52, RN 0.76.9).

## 1. Redirects to remove (audit §8)
Replace these `Linking.openURL('https://pharm.synapseos.tech/portal/…')` escapes with native
screens backed by mobile APIs:

| Portal path | Mobile entry point | Native replacement |
|-------------|--------------------|--------------------|
| `/portal/dashboard` | `profile.tsx` | native pharmacy home (exists) |
| `/portal/inventory` (Excel) | `profile.tsx`, `stock-import.tsx` | native import w/ document picker |
| `/portal/refunds` | `profile.tsx` | native refunds/returns screen |
| `/portal/reports` | `profile.tsx` | native reports + PDF/CSV share |
| `/portal/users` | `profile.tsx` | native users & settings |
| `/portal/billing` | `profile.tsx`, `billing-locked.tsx` | native subscription screen |

## 2. Missing mobile APIs to add (BFF under `apps/web/src/app/api/mobile/pharmacy/**`)
Each must apply `requireMobilePharmacyAuth` + tenant scoping + capability checks, mirroring the
portal `/api/admin/*` behaviour.

- `reports` (sales summary, gross profit, product performance, stock valuation, low-stock,
  expiry, batch, cashier, payment-method, refund, purchase) with date filters + CSV/PDF payloads.
- `refunds` / `returns` (list, create, partial, manager approval).
- `suppliers`, `purchase-orders` (+ approval, partial receiving), `receiving`/GRN (must call
  `receive_pharmacy_stock` so stock enters via a real batch — Phase 1 rule).
- `users` (list, invite, disable/reactivate, role/branch/permission).
- `settings` (pharmacy identity, TIN, NDA licence, supervising pharmacist + registration number,
  logo, receipt header/footer, currency, VAT/EFRIS, discount threshold, printer, notifications, security).
- `sales/:id`, `sales/:id/receipt`, `sales/:id/receipt.pdf`, `sales/:id/share-log`, `sales/:id/reprint` (Phase 3).
- POS depth: held carts, cashier sessions (open/close), supervisor approval, offline draft + idempotent checkout.

## 3. Expo dependencies (verify against SDK 52 before adding)
Native receipts/import need: `expo-print`, `expo-sharing`, `expo-file-system`,
`expo-document-picker`, `expo-mail-composer`, and a barcode scanner (`expo-camera`). Pin the
SDK-52-compatible versions via `npx expo install` (do not hand-pick incompatible versions).

## 4. Receipt domain (Phase 3)
One shared receipt-domain service (pharmacy web, Expo, future hospital pharmacy, PDF, thermal):
- **Immutable snapshot** at sale time — later product edits never change a historical receipt.
- Content per the brief (legal/trading name, logo, address, TIN, NDA licence, supervising
  pharmacist + registration no., receipt no., Kampala-local time, branch/terminal/cashier,
  patient/Synapse-ID where consented, per-line generic/strength/form/qty/unit/pack/price/discount/
  batch/expiry/manufacturer, subtotal/tax/total, payment method/ref/amount received/change,
  refund/void status, footer, fiscal doc no + EFRIS code/QR **only when EFRIS accepted**, Synapse QR).
- **Never label a receipt "fiscal" unless EFRIS accepted it**; otherwise mark POS/non-fiscal.
- Native actions: preview after sale, open from history, generate PDF, save to phone, share sheet,
  WhatsApp, email, print/reprint (with reprint watermark), print-failure handling, verification.

## 5. Offline-safe POS
Add an outbox queue (AsyncStorage/SQLite) for draft carts and checkout, replayed with the
existing idempotency key so retries cannot double-sell. Show sync status; never present stale
stock as confirmed without an indicator.
