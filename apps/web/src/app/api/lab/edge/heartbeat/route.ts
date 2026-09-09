import { NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"

export const dynamic = "force-dynamic"

const HEARTBEAT_FIELDS = new Set([
  "bridgeId", "deviceId", "edgeVersion", "serviceState", "timestamp", "queueDepth",
  "queuedCount", "failedCount", "deadLetterCount", "lastSuccessfulUpload", "deviceIds",
])

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-lab-bridge-key")?.trim()
  if (!apiKey) return NextResponse.json({ error: "x-lab-bridge-key required" }, { status: 401 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || Object.keys(body).some((key) => !HEARTBEAT_FIELDS.has(key))) {
    return NextResponse.json({ error: "Heartbeat contains unsupported fields" }, { status: 400 })
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : ""
  const bridgeId = typeof body.bridgeId === "string" ? body.bridgeId.trim() : ""
  const db = supabaseAdmin as any
  const { data: bridge } = await db
    .from("lab_instrument_bridges")
    .select("id, tenant_id, device_id, is_active")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .maybeSingle()
  if (!bridge || (bridgeId && bridge.id !== bridgeId)) return NextResponse.json({ error: "Invalid or inactive bridge key" }, { status: 401 })
  if (!deviceId || bridge.device_id !== deviceId) return NextResponse.json({ error: "Registered device is required for this bridge" }, { status: 403 })

  const { data: device } = await db
    .from("lab_devices")
    .select("id, active")
    .eq("id", deviceId)
    .eq("tenant_id", bridge.tenant_id)
    .maybeSingle()
  if (!device || !device.active) return NextResponse.json({ error: "Device is not registered or active" }, { status: 403 })

  const now = new Date().toISOString()
  const { error } = await db.from("lab_instrument_bridges").update({
    last_seen_at: now,
    edge_version: typeof body.edgeVersion === "string" ? body.edgeVersion : null,
    service_state: typeof body.serviceState === "string" ? body.serviceState : "ERROR",
    queue_summary: {
      queueDepth: Number(body.queueDepth ?? 0),
      queuedCount: Number(body.queuedCount ?? 0),
      failedCount: Number(body.failedCount ?? 0),
      deadLetterCount: Number(body.deadLetterCount ?? 0),
    },
    last_successful_upload: typeof body.lastSuccessfulUpload === "string" ? body.lastSuccessfulUpload : null,
    heartbeat_at: typeof body.timestamp === "string" ? body.timestamp : now,
  }).eq("id", bridge.id).eq("tenant_id", bridge.tenant_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await db.from("lab_devices").update({ last_seen_at: now, health_status: "ONLINE" }).eq("id", deviceId).eq("tenant_id", bridge.tenant_id)
  return NextResponse.json({ ok: true, bridgeId: bridge.id, deviceId, heartbeatAt: now })
}