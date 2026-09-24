import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  normalizeLifecycleState,
  previewFacilityLifecycle,
  type FacilityLifecycleAction,
} from "@synapse/db/facility-lifecycle"
import { requirePlatformAdminApi } from "@/lib/platform/auth"
import { logPlatformEvent } from "@/app/platform/_lib/platform-data"

export const dynamic = "force-dynamic"

const ACTIONS = new Set<FacilityLifecycleAction>([
  "suspend",
  "resume",
  "archive",
  "restore",
  "request_delete",
  "cancel_delete",
  "purge",
])

async function loadImpact(tenantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const [{ count: patients }, { count: encounters }, { count: invoices }, { count: staff }] = await Promise.all([
    db.from("patients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    db.from("encounters").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    db.from("billing_invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    db.from("staff_scope_assignments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
  ])
  return {
    patients: patients ?? 0,
    encounters: encounters ?? 0,
    invoices: invoices ?? 0,
    staffExclusive: staff ?? 0,
    staffShared: 0,
  }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdminApi("platform.dashboard.read")
  if (!auth.ok) return auth.response
  const { id } = await context.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: tenant, error } = await db
    .from("tenants")
    .select("id, status, is_active, lifecycle_status, facility_type, name, slug, metadata, is_synthetic")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tenant) return NextResponse.json({ error: "Facility not found" }, { status: 404 })
  const counts = await loadImpact(id)
  const isSynthetic = Boolean(
    tenant.is_synthetic === true ||
      tenant.metadata?.synthetic ||
      tenant.metadata?.is_synthetic ||
      String(tenant.name ?? "").toLowerCase().includes("synthetic") ||
      String(tenant.slug ?? "").includes("accept") ||
      String(tenant.slug ?? "").includes("syn-accept"),
  )
  return NextResponse.json({
    tenantId: id,
    name: tenant.name,
    currentState: normalizeLifecycleState(tenant.lifecycle_status ?? tenant.status, tenant.is_active !== false),
    isSynthetic,
    counts,
  })
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdminApi("tenant.manage")
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const body = await req.json().catch(() => null) as { action?: string; reason?: string } | null
  const action = body?.action as FacilityLifecycleAction | undefined
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown lifecycle action" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: tenant, error } = await db
    .from("tenants")
    .select("id, status, is_active, lifecycle_status, facility_type, name, slug, metadata, is_synthetic")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tenant) return NextResponse.json({ error: "Facility not found" }, { status: 404 })

  const currentState = normalizeLifecycleState(tenant.lifecycle_status ?? tenant.status, tenant.is_active !== false)
  const counts = await loadImpact(id)
  const isSynthetic = Boolean(
    tenant.is_synthetic === true ||
      tenant.metadata?.synthetic ||
      tenant.metadata?.is_synthetic ||
      String(tenant.name ?? "").toLowerCase().includes("synthetic") ||
      String(tenant.slug ?? "").includes("accept") ||
      String(tenant.slug ?? "").includes("syn-accept"),
  )
  const preview = previewFacilityLifecycle({
    tenantId: id,
    currentState,
    action,
    isSynthetic,
    allowHardPurge: process.env.SYNAPSE_ALLOW_HARD_PURGE === "true",
    counts,
  })

  if (["suspend", "archive", "request_delete", "purge"].includes(action) && !String(body?.reason ?? "").trim()) {
    return NextResponse.json({ preview, error: "Reason required" }, { status: 400 })
  }

  if (!preview.allowed || !preview.nextState) {
    return NextResponse.json({ preview }, { status: 409 })
  }

  const next = preview.nextState
  // tenants.status CHECK allows only provisioning|active|suspended|trial.
  // lifecycle_status holds ARCHIVE / DELETION_PENDING / DELETED.
  const operationalStatus =
    next === "ACTIVE" ? (tenant.status === "trial" ? "trial" : "active") : "suspended"
  const { error: updateError } = await db
    .from("tenants")
    .update({
      lifecycle_status: next,
      status: operationalStatus,
      is_active: next === "ACTIVE",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (updateError) return NextResponse.json({ error: updateError.message, preview }, { status: 500 })

  const correlationId = crypto.randomUUID()
  await db.from("facility_lifecycle_events").insert({
    tenant_id: id,
    actor_id: auth.profile.id,
    action,
    from_state: currentState,
    to_state: next,
    reason: body?.reason ?? null,
    correlation_id: correlationId,
    impact: preview,
  })
  await logPlatformEvent({
    actorId: auth.profile.id,
    actorRole: auth.profile.platformRole,
    action: `FACILITY_${action.toUpperCase()}`,
    entityType: "tenant",
    entityId: id,
    metadata: { correlation_id: correlationId, from: currentState, to: next },
  }).catch(() => {})

  return NextResponse.json({ preview: { ...preview, correlationId } })
}
