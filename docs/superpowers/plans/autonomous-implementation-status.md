# Synapse OS — Autonomous Build Implementation Status

**Phase 0 Discovery** | Scanned: 2026-06-13 | DB: `qfqakzmjatszisuqjwon` (EU-West-1)

---

## Ground Truth: Live DB (183+ tables)

### ALREADY BUILT — DO NOT RECREATE

#### Auth
| Table / Function | Status |
|---|---|
| `profiles` | ✅ exists — `id, email, role, tenant_id, synapse_id, password_hash, login_attempts, locked_until` |
| `auth_otps` | ✅ exists — `channel, target, otp_hash, expires_at, used_at, attempt_count` |
| `mfa_enrollments` | ✅ exists — TOTP for platform_admin |
| `synapse_sessions` | ✅ exists — `token_hash, user_id, app, ip, user_agent, expires_at, revoked_at` |

#### Capability Lattice
| Table / Function | Status |
|---|---|
| `capabilities` | ✅ 39 rows seeded |
| `role_capabilities` | ✅ seeded |
| `role_hierarchy` | ✅ `doctor→clinical_officer→nurse` |
| `facility_type_inheritance` | ✅ `hospital⊇clinic⊇pharmacy` |
| `has_capability(role, facility_type, module, resource, action)` | ✅ SECURITY DEFINER |
| `expand_roles(role)` | ✅ recursive CTE |
| `expand_facility_types(type)` | ✅ recursive CTE |
| `same_tenant(tenant_id)` | ✅ RLS helper |

#### Reasoning Engine
| Table | Status |
|---|---|
| `reasoning_sessions` | ✅ |
| `reasoning_hypotheses` | ✅ `prior_probability, posterior_probability, harm_if_missed, expected_harm, cant_miss, rank, status` |
| `reasoning_evidence` | ✅ |
| `reasoning_evidence_impact` | ✅ |
| `reasoning_actions` | ✅ |
| `reasoning_audit` | ✅ |
| `recompute_differential(session_id)` | ✅ Bayesian log-odds, sigmoid, expected_harm sort |

#### Clinical
| Table | Status |
|---|---|
| `encounters`, `encounter_diagnoses` | ✅ |
| `prescriptions`, `prescription_items` | ✅ |
| `vitals` | ✅ — linked via `encounter_id` (no direct `patient_id`) |
| `patients`, `patient_facilities` | ✅ |

#### Pharmacy
| Table | Status |
|---|---|
| `pharmacy_products`, `pharmacy_product_batches` | ✅ |
| `pharmacy_product_packages` | ✅ |
| `pharmacy_stores`, `pharmacy_transactions` | ✅ |
| `pharmacy_suppliers` | ✅ |
| `pharmacy_stock_adjustments` | ✅ **ALREADY EXISTS** — spec incorrectly listed as missing |
| `pharmacy_onboarding` | ✅ |
| `pharmacy_network_inventory` | ✅ |
| `pharmacy_profiles` | ✅ |

#### Insurance (partial)
| Table | Status |
|---|---|
| `insurance_claims` | ✅ |
| `claim_line_items` | ✅ |
| `claim_resubmissions` | ✅ |
| `payer_contracts` | ✅ |
| `denial_analytics_daily` | ✅ |

#### Platform
| Table | Status |
|---|---|
| `tenants` | ✅ |
| `hospital_modules` | ✅ |
| `import_batches`, `import_batch_rows` | ✅ |

#### Audit / Security
| Table | Status |
|---|---|
| `audit_log` | ✅ **ALREADY EXISTS** |
| `phi_access_log` | ✅ **ALREADY EXISTS** |

---

### TRULY MISSING — BUILD THESE

#### Phase 3: Subscriptions
- [ ] `subscription_plans`
- [ ] `plan_features`
- [ ] `tenant_subscriptions`
- [ ] `tenant_feature_overrides`
- [ ] SQL function: `has_feature(tenant_id, feature_key)`

#### Phase 5: Pharmacy POS
- [ ] `pharmacy_cashier_sessions`
- [ ] `pharmacy_carts`
- [ ] `pharmacy_cart_items`
- [ ] `pharmacy_pos_sales`
- [ ] `pharmacy_pos_sale_items`
- [ ] `pharmacy_refunds`
- NOTE: `pharmacy_stock_adjustments` ALREADY EXISTS — SKIP

#### Phase 6: Insurance Copilot
- [ ] `insurance_policies`
- [ ] `insurance_benefits`
- [ ] `insurance_preauthorizations`
- [ ] `insurance_coverage_checks`
- [ ] `insurance_copilot_audit`

#### Phase 7: Longitudinal Intelligence
- [ ] `patient_clinical_patterns`
- [ ] `patient_intervention_outcomes`
- [ ] `reasoning_context_snapshots`

---

## Auth Risk Inventory

| Risk | Status |
|---|---|
| Google OAuth callback never minted synapse_session | **FIXED** (prior session) |
| Magic link flow existed without session minting | **REMOVED** (prior session) |
| Login UIs had OAuth buttons | **REMOVED** (prior session) |
| password-login issues full session without OTP | **FIXED** — now returns `{otpSent:true}` |
| platform_admin TOTP gate | **EXISTS** — mfa_enrollments table present; gate enforcement needs Phase 1 verify |
| Pharmacy login two-step flow | **BUILT** — `/api/auth/login` + `/api/auth/otp-verify` |

---

## RLS Gap Inventory (Phase 9)

Tables confirmed to have zero or incomplete RLS policies (to be fixed in Phase 9):
- All Phase 3 tables (new)
- All Phase 5 tables (new)
- All Phase 6 tables (new)
- All Phase 7 tables (new)

Existing tables `audit_log` and `phi_access_log` — RLS status to be verified in Phase 9.

---

## Build Commands

```bash
# apps/web
NODE_OPTIONS=--max-old-space-size=4096 npx turbo build --filter=web

# apps/pharmacy
NODE_OPTIONS=--max-old-space-size=4096 npx turbo build --filter=pharmacy

# clean .next on Windows ENOENT
Remove-Item -Recurse -Force apps/web/.next, apps/pharmacy/.next -ErrorAction SilentlyContinue
```

---

## Phase Checklist

| Phase | Description | Status |
|---|---|---|
| 0 | Discovery — DB scan, this document | ✅ Complete |
| 1 | Auth Stabilization | 🔄 In Progress |
| 2 | Capability Lattice Extension | ⏳ Pending |
| 3 | Subscriptions & Feature Gates | ⏳ Pending |
| 4 | Tenant Onboarding | ⏳ Pending |
| 5 | Pharmacy POS | ⏳ Pending |
| 6 | Insurance Copilot | ⏳ Pending |
| 7 | Longitudinal Patient Intelligence | ⏳ Pending |
| 8 | Probabilistic Reasoning Integration | ⏳ Pending |
| 9 | RLS / Audit / PHI Hardening | ⏳ Pending |
| 10 | Final Verification | ⏳ Pending |

---

## Hard Gates (Never Violate)

1. **Production safety**: Additive only — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`. No DROP/TRUNCATE/destructive ALTER.
2. **No duplicate source-of-truth** — inspect DB before creating tables.
3. **Auth**: Every successful login path mints a valid `synapse_session`. `getContext()` reads only synapse_session. No half-authenticated admins.
4. **Tenant isolation**: Every tenant table: `tenant_id` + RLS + server capability check + audit on write + PHI log on PHI read.
5. **Clinical/financial**: AI never the final actor. No auto: diagnosis-confirm, claim-submit, preauth-submit, dispense, POS-post, inventory-decrement, appeal-send. Human confirm required.
6. **Code**: No hardcoded UUIDs, no client-exposed service key, no new `any`, no dead auth flows, no duplicate login UIs, no broken builds.
