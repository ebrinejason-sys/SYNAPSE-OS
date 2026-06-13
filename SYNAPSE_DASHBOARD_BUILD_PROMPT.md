# Synapse Dashboard Build Prompt

Build Synapse OS as a multi-tenant healthcare operating system with separate but aligned experiences for platform administration, hospitals, standalone pharmacies, hospital pharmacy departments, clinical departments, support teams, independent health professionals, and mobile users.

## Core Rules

- Every route must be tenant-scoped and role/permission protected.
- Platform admins manage the ecosystem; hospital admins manage one facility; standalone pharmacy admins manage one pharmacy tenant; hospital pharmacy admins manage a pharmacy department inside a hospital tenant.
- Admin roles must support TOTP MFA with Google Authenticator or any compatible authenticator app.
- Use dark-first UI with Synapse orange `#F97316`, gold `#E8B84B`, near-black `#07070A`, lucide icons, responsive tables, empty states, skeleton loading, audit logs, and clear error states.
- Use predictable URL routing:
  - `/admin/platform/*`
  - `/admin/hospital/*`
  - `/admin/pharmacy/*`
  - `/hospital/departments/:department/*`
  - `/pharmacy/*`
  - `/staff/:role/*`
  - `/professional/*`
  - `/app/*` for shared mobile/API flows.
- Keep the web app and Expo APK aligned around shared auth, role names, tenant IDs, notification payloads, and API contracts.

## Platform Admin Dashboard

Create a command center for Synapse operators:

- Tenant onboarding for hospitals, clinics, standalone pharmacies, labs, imaging centers, mortuaries, and independent professionals.
- Facility verification, licensing document review, status controls, subscription plan controls, billing health, and feature flags.
- System-wide analytics: active tenants, appointments, pharmacy transactions, claims, patients served, departments active, failed payments, API health, and support tickets.
- User and admin management with MFA enforcement, impersonation/audit-safe support mode, invite flows, role templates, and access revocation.
- Integration control center for payments, SMS/email, insurance, labs, radiology, pharmacy imports, and government/reporting APIs.
- Compliance dashboard with audit logs, suspicious access alerts, data export requests, retention controls, and incident reporting.
- Global content/settings: specialty lists, drug catalog seeds, department templates, notification templates, printer presets, and country/region settings.

## Hospital Admin Dashboard

Create a facility operations dashboard:

- Facility profile, departments, branches/wards, logo, contacts, location, operating hours, receipt/header details, and service catalog.
- Staff creation and assignment for doctors, nurses, radiologists, pharmacists, cleaners, mortuary staff, gate keepers, accountants, receptionists, and department heads.
- Department dashboards for outpatient, inpatient, pharmacy department, laboratory, radiology, theatre/surgery, maternity, mortuary, housekeeping, finance, records, and security/gate.
- Patient flow: registration, triage, consultation, orders, admission, transfer, discharge, referrals, follow-up, and billing.
- Finance: invoices, payments, credit balances, insurance claims, debtor tracking, department performance, expenses, and daily close.
- Inventory and procurement: supplies, purchase requests, stock movement, low-stock alerts, supplier management, receiving, and wastage.
- Reports: patient volumes, revenue, department utilization, staff performance, waiting times, mortality, theatre utilization, bed occupancy, and inventory valuation.
- Security: audit logs, MFA for admins, permission templates, session revocation, and critical-action approvals.

## Standalone Pharmacy Admin Dashboard

Create the standalone pharmacy experience as a complete business system:

- Staff management: create staff, assign pharmacy roles, grant granular permissions for inventory, POS, reports, settings, refunds, transactions, imports, and customer management.
- Inventory: drug registration, bulk upload, stock adjustments, batches, expiry tracking, barcode/SKU, suppliers, purchase orders, receiving, low-stock alerts, and stock valuation.
- POS: cart, discounts, taxes, payment methods, receipt printing, refunds, offline queue, transaction verification, and customer linking.
- Customers: registration, purchase history, refill reminders, due refill queue, contact tracking, adherence notes, and follow-up status.
- Credit ledger: customers buying on credit, repayments, outstanding balances, overdue accounts, due dates, notes, finance/accountant dashboard, and exportable reports.
- AI function: build an Import Assistant that maps columns from any previous pharmacy system into Synapse inventory fields, flags unclear columns, detects duplicates/expiry issues, and produces a reviewable import session before committing data.
- Settings: pharmacy name, logo, contacts, location, receipt footer, tax settings, currency, printer type, print paper size, barcode settings, and branch details.
- Reports: daily sales, profit, stock movement, expiry risk, debtor report, staff performance, payment breakdown, supplier performance, refunds, and audit logs.

## Hospital Pharmacy Department

When a pharmacy is under a hospital, treat it as a department inside the hospital tenant:

- Use the same inventory, POS, refill, and purchase-order engine where appropriate.
- Add hospital-only workflows: dispensing against doctor prescriptions, inpatient ward issue, theatre/maternity stock issue, insurance billing linkage, and department-level cost centers.
- Department pharmacists should see pharmacy operations, while hospital admins see aggregate pharmacy performance inside the hospital command center.

## Staff Dashboards

Create role-specific dashboards with only the workflows that role needs:

- Doctor: schedule, patient queue, consultations, notes, diagnoses, prescriptions, lab/radiology orders, admissions, referrals, follow-ups, and clinical history.
- Nurse: triage, vitals, patient queue, medication administration, ward tasks, care notes, handover, maternal/partograph records, and procedure assistance.
- Radiologist: imaging queue, order details, report entry, image/result upload, status updates, urgent findings, and referring-doctor communication.
- Cleaner/Housekeeping: assigned areas, cleaning tasks, priority rooms, infection-control status, completion logs, supply requests, and supervisor notes.
- Mortician: body register, release status, next-of-kin details, storage location, documentation checklist, billing link, and release audit trail.
- Gate keeper/Security: visitor log, vehicle log, patient/visitor verification, emergency flags, pass issuance, and daily incident report.
- Day-to-day user/reception: patient registration, appointments, queue management, payment capture, directions, and support tickets.
- Independent health professional: profile, license verification, appointments, patient notes, prescriptions/referrals, invoices, telehealth links, and personal reports.

## Mobile APK Alignment

Align the Expo project at `C:\Users\ebrin\Synapse-app` with the web ecosystem:

- Reuse the same auth model, tenant ID, role names, permission constants, and API response shapes.
- Mobile dashboards should focus on field workflows: doctor/nurse tasks, pharmacy POS-lite, refill follow-ups, notifications, offline queue, and quick patient lookup.
- Push notifications should cover refill due dates, assigned tasks, urgent clinical orders, low stock, credit due dates, visitor/security alerts, and admin approvals.
- Design mobile routes to mirror web capabilities without copying dense desktop layouts.

## Implementation Priority

1. Finish pharmacy operational core: refills, credit ledger, import assistant, staff permissions, settings, receipt/printer setup, and bulk upload commit flow.
2. Harden admin security: TOTP MFA enforcement, audit logs, role templates, and session controls.
3. Expand hospital department dashboards and connect pharmacy-as-department flows.
4. Create platform admin controls for tenant onboarding, subscriptions, compliance, and ecosystem analytics.
5. Align Expo mobile screens and shared API contracts.
