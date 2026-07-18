import { NextRequest, NextResponse } from "next/server"
import {
  createSession,
  hashPassword,
  signToken,
  validatePasswordStrength,
} from "@synapse/auth"
import { SESSION_COOKIE, SESSION_DURATION_DAYS, UGANDA_DISTRICTS } from "@synapse/config/constants"
import { sendWelcome } from "@synapse/email"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const PLAN_SLUGS = new Set(["pharm_monthly", "pharm_quarterly", "pharm_yearly"])
const PHONE_RE = /^\+256[7]\d{8}$/

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
}

type RegisterBody = {
  pharmacyName?: string
  licenseNumber?: string
  district?: string
  physicalAddress?: string
  fullName?: string
  phone?: string
  email?: string
  password?: string
  planSlug?: string
  pdpoConsent?: boolean
}

async function cleanupTenant(tenantId: string) {
  await supabaseAdmin.from("pharmacy_user_settings").delete().eq("tenant_id", tenantId)
  await supabaseAdmin.from("profiles").delete().eq("tenant_id", tenantId)
  await supabaseAdmin.from("pharmacy_stores").delete().eq("tenant_id", tenantId)
  await supabaseAdmin.from("tenant_subscriptions").delete().eq("tenant_id", tenantId)
  await supabaseAdmin.from("pharmacy_onboarding").delete().eq("tenant_id", tenantId)
  await supabaseAdmin.from("pharmacy_profiles").delete().eq("tenant_id", tenantId)
  await supabaseAdmin.from("tenants").delete().eq("id", tenantId)
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as RegisterBody

  const pharmacyName = String(body.pharmacyName ?? "").trim()
  const licenseNumber = String(body.licenseNumber ?? "").trim()
  const district = String(body.district ?? "").trim()
  const physicalAddress = String(body.physicalAddress ?? "").trim()
  const fullName = String(body.fullName ?? "").trim()
  const phone = String(body.phone ?? "").trim().replace(/\s+/g, "")
  const email = String(body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")
  const planSlug = String(body.planSlug ?? "pharm_monthly").trim()
  const pdpoConsent = Boolean(body.pdpoConsent)

  if (!pharmacyName || pharmacyName.length < 2) {
    return NextResponse.json({ error: "Pharmacy name is required." }, { status: 400 })
  }
  if (!licenseNumber) {
    return NextResponse.json(
      { error: "NDA / Pharmacy Board licence number is required." },
      { status: 400 },
    )
  }
  if (!(UGANDA_DISTRICTS as readonly string[]).includes(district)) {
    return NextResponse.json({ error: "Select a valid Uganda district." }, { status: 400 })
  }
  if (!physicalAddress) {
    return NextResponse.json({ error: "Physical address is required." }, { status: 400 })
  }
  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 })
  }
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { error: "Phone must be in +256 format (e.g. +2567XXXXXXXX)." },
      { status: 400 },
    )
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  }
  const pwCheck = validatePasswordStrength(password)
  if (!pwCheck.valid) {
    return NextResponse.json(
      { error: pwCheck.errors[0] ?? "Password is too weak." },
      { status: 400 },
    )
  }
  if (!PLAN_SLUGS.has(planSlug)) {
    return NextResponse.json({ error: "Select a valid plan." }, { status: 400 })
  }
  if (!pdpoConsent) {
    return NextResponse.json(
      { error: "PDPO consent is required to create an account." },
      { status: 400 },
    )
  }

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Sign in instead." },
      { status: 409 },
    )
  }

  const { data: plan, error: planErr } = await supabaseAdmin
    .from("subscription_plans")
    .select("id, slug, billing_cycle, price_ugx")
    .eq("slug", planSlug)
    .eq("facility_type", "pharmacy")
    .eq("is_active", true)
    .maybeSingle()

  if (planErr || !plan) {
    return NextResponse.json({ error: "Selected plan is unavailable." }, { status: 400 })
  }

  const baseSlug = slugify(pharmacyName) || "pharmacy"
  let slug = `pharm-${baseSlug}`
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (!clash) break
    slug = `pharm-${baseSlug}-${Math.floor(Math.random() * 9000 + 1000)}`
  }

  const tenantId = crypto.randomUUID()
  const profileId = crypto.randomUUID()
  const now = new Date()
  const trialEnds = new Date(now)
  trialEnds.setDate(trialEnds.getDate() + 7)
  const passwordHash = await hashPassword(password)
  const nameParts = fullName.split(/\s+/)
  const firstName = nameParts[0] ?? fullName
  const lastName = nameParts.slice(1).join(" ") || "Admin"

  const { error: tenantErr } = await supabaseAdmin.from("tenants").insert({
    id: tenantId,
    slug,
    name: pharmacyName,
    facility_type: "pharmacy",
    district,
    address: physicalAddress,
    phone,
    email,
    is_active: true,
    status: "active",
    // tenants.plan CHECK only allows trial|starter|professional|enterprise
    // (legacy column). Canonical pharmacy pricing lives on tenant_subscriptions.
    plan: "trial",
    onboarding_completed: true,
    onboarding_step: 5,
    country_code: "UG",
    country: "Uganda",
    default_subdomain: slug,
    modules_enabled: ["inventory", "dispensing", "network", "staff", "reports"],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  })

  if (tenantErr) {
    return NextResponse.json({ error: tenantErr.message }, { status: 400 })
  }

  try {
    const { error: ppErr } = await supabaseAdmin.from("pharmacy_profiles").insert({
      tenant_id: tenantId,
      pharmacy_name: pharmacyName,
      license_number: licenseNumber,
      district,
      physical_address: physicalAddress,
      contact_person: fullName,
      contact_phone: phone,
      contact_email: email,
      default_domain: `https://pharm.synapseos.tech/${slug.replace(/^pharm-/, "")}`,
      theme_color: "#F97316",
      migration_status: "ready",
      is_network_visible: false,
      delivery_available: false,
      custom_domain_verified: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    if (ppErr) throw new Error(ppErr.message)

    const { error: subErr } = await supabaseAdmin.from("tenant_subscriptions").insert({
      tenant_id: tenantId,
      plan_id: plan.id,
      status: "trialing",
      starts_at: now.toISOString(),
      trial_ends: trialEnds.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnds.toISOString(),
      cancel_at_period_end: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    if (subErr) throw new Error(subErr.message)

    const { error: storeErr } = await supabaseAdmin.from("pharmacy_stores").insert({
      tenant_id: tenantId,
      name: `${pharmacyName} — Main Branch`,
      store_type: "main",
      is_active: true,
    })
    if (storeErr) throw new Error(storeErr.message)

    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      id: profileId,
      email,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      phone,
      role: "pharmacy_admin",
      tenant_id: tenantId,
      is_admin: true,
      password_hash: passwordHash,
      password_changed_at: now.toISOString(),
      must_change_password: false,
      onboarding_complete: true,
      email_verified_at: now.toISOString(),
      verification_status: "verified",
      last_sign_in_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    if (profileErr) throw new Error(profileErr.message)

    const { error: settingsErr } = await supabaseAdmin.from("pharmacy_user_settings").insert({
      profile_id: profileId,
      tenant_id: tenantId,
      pharmacy_role: "pharmacy_admin",
      permissions: [],
      is_active: true,
      must_change_password: false,
      created_by: profileId,
    })
    if (settingsErr) throw new Error(settingsErr.message)

    await supabaseAdmin.from("pharmacy_onboarding").upsert(
      {
        tenant_id: tenantId,
        admin_email: email,
        admin_name: fullName,
        current_step: 5,
        account_created_at: now.toISOString(),
        profile_completed_at: now.toISOString(),
        store_setup_at: now.toISOString(),
        onboarding_completed_at: now.toISOString(),
        notes: `Self-serve register · PDPO consent=${pdpoConsent} · plan=${planSlug}`,
        updated_at: now.toISOString(),
      },
      { onConflict: "tenant_id" },
    )
  } catch (err) {
    await cleanupTenant(tenantId)
    const message = err instanceof Error ? err.message : "Registration failed."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    await sendWelcome({
      to: email,
      name: fullName,
      product: "Synapse Pharm",
      ctaUrl: "https://pharm.synapseos.tech/portal/dashboard",
      ctaLabel: "Open pharmacy dashboard →",
    })
  } catch (emailErr) {
    console.error("[register] welcome email failed:", emailErr)
  }

  const token = await signToken({
    sub: profileId,
    email,
    role: "pharmacy_admin",
    tenant_id: tenantId,
    app: "pharmacy",
  })

  await createSession({
    userId: profileId,
    token,
    app: "pharmacy",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  })

  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)

  const response = NextResponse.json({
    ok: true,
    tenantId,
    profileId,
    slug,
    planSlug,
    status: "trialing",
    trialEnds: trialEnds.toISOString(),
    redirect: "/portal/dashboard",
  })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  })
  return response
}
