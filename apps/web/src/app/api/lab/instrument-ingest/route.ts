import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@synapse/db/admin"

export const dynamic = "force-dynamic"

/**
 * Lab Edge / instrument bridge ingest.
 * Stores immutable raw message first. Never writes released clinical results.
 * Matching → staging only; human verification remains required.
 */
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-lab-bridge-key")?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: "x-lab-bridge-key required" }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: bridge } = await db
    .from("lab_instrument_bridges")
    .select("id, tenant_id, name, is_active, device_id")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .maybeSingle()

  if (!bridge) {
    // Also accept lab_devices configuration.credential_ref later; for now require bridge key
    return NextResponse.json({ error: "Invalid or inactive bridge key" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : ""
  if (!deviceId || !bridge.device_id || bridge.device_id !== deviceId) {
    return NextResponse.json({ error: "Registered device is required for this bridge" }, { status: 403 })
  }
  const { data: device } = await db
    .from("lab_devices")
    .select("id, tenant_id, active, validation_status")
    .eq("id", deviceId)
    .eq("tenant_id", bridge.tenant_id)
    .maybeSingle()
  if (!device || !device.active) return NextResponse.json({ error: "Device is not registered or active" }, { status: 403 })

  const rawPayload = String(body.rawPayload ?? body.raw ?? body.message ?? "")
  if (!rawPayload) {
    return NextResponse.json({ error: "rawPayload required" }, { status: 400 })
  }

  const protocol = String(body.protocol ?? "other")
  const accession = typeof body.accessionNumber === "string" ? body.accessionNumber.trim() : null
  const correlationId = typeof body.correlationId === "string" ? body.correlationId : crypto.randomUUID()
  const payloadHash = createHash("sha256").update(rawPayload).digest("hex")
  const messageControlId =
    typeof body.messageControlId === "string" ? body.messageControlId : null

  const { data: duplicate } = await db
    .from("lab_device_messages")
    .select("id")
    .eq("tenant_id", bridge.tenant_id)
    .eq("payload_hash", payloadHash)
    .eq("message_control_id", messageControlId ?? "")
    .maybeSingle()
  if (duplicate?.id) return NextResponse.json({ ok: true, messageId: duplicate.id, duplicate: true, match: "DUPLICATE" })

  // Prefer lab_device_messages when migrated; fall back to lab_analyzer_messages
  let messageId: string | null = null
  const deviceMessage = {
    tenant_id: bridge.tenant_id,
    device_id: deviceId,
    direction: "inbound",
    protocol,
    raw_payload: rawPayload,
    payload_hash: payloadHash,
    message_control_id: messageControlId,
    parse_status: "RAW",
    processing_status: "RECEIVED",
    correlation_id: correlationId,
  }

  const { data: inserted, error: msgErr } = await db
    .from("lab_device_messages")
    .insert(deviceMessage)
    .select("id")
    .maybeSingle()

  if (msgErr) {
    if (/duplicate|unique/i.test(msgErr.message ?? "")) {
      const { data: existing } = await db
        .from("lab_device_messages")
        .select("id")
        .eq("tenant_id", bridge.tenant_id)
        .eq("payload_hash", payloadHash)
        .maybeSingle()
      if (existing?.id) return NextResponse.json({ ok: true, messageId: existing.id, duplicate: true, match: "DUPLICATE" })
    }
    // Table may not exist yet — legacy analyzer messages table
    const { data: legacy, error: legacyErr } = await db
      .from("lab_analyzer_messages")
      .insert({
        tenant_id: bridge.tenant_id,
        analyzer_id: bridge.id,
        protocol: protocol === "hl7" || protocol === "astm" ? protocol : "other",
        accession_number: accession,
        raw_message: rawPayload,
        direction: "inbound",
        parsed: { correlationId, note: "awaiting_pipeline" },
      })
      .select("id")
      .maybeSingle()
    if (legacyErr) {
      return NextResponse.json(
        { error: "Failed to persist raw message", detail: legacyErr.message },
        { status: 500 },
      )
    }
    messageId = legacy?.id ?? null
  } else {
    messageId = inserted?.id ?? null
  }

  await db
    .from("lab_instrument_bridges")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", bridge.id)
  await db
    .from("lab_devices")
    .update({ last_seen_at: new Date().toISOString(), last_message_at: new Date().toISOString(), health_status: "ONLINE" })
    .eq("id", deviceId)
    .eq("tenant_id", bridge.tenant_id)

  // Stage unmatched if no accession — never invent patient match
  let stagingStatus = "RECEIVED"
  let labOrderId: string | null = null
  if (accession) {
    const { data: specimen } = await db
      .from("lab_specimens")
      .select("id, lab_order_id, patient_id")
      .eq("tenant_id", bridge.tenant_id)
      .eq("accession_number", accession)
      .maybeSingle()

    if (specimen?.lab_order_id) {
      labOrderId = specimen.lab_order_id
      stagingStatus = "MATCHED"
    } else {
      stagingStatus = "UNMATCHED"
    }
  } else {
    stagingStatus = "UNMATCHED"
  }

  const observations = Array.isArray(body.observations)
    ? body.observations as Record<string, unknown>[]
    : [{ analyzerCode: body.analyzerCode, value: body.value, unit: body.unit, flags: body.flags, instrumentFlags: body.instrumentFlags }]
  const stagingRows = []
  for (const observation of observations) {
    const analyzerCode = typeof observation.analyzerCode === "string" ? observation.analyzerCode : null
    const { data: mapping } = analyzerCode
      ? await db.from("lab_device_test_mappings").select("loinc_code, analyzer_name").eq("tenant_id", bridge.tenant_id).eq("device_id", deviceId).eq("analyzer_code", analyzerCode).eq("active", true).maybeSingle()
      : { data: null }
    stagingRows.push({
      tenant_id: bridge.tenant_id,
      device_id: deviceId,
      device_message_id: messageId,
      lab_order_id: labOrderId,
      accession_number: accession,
      analyzer_code: analyzerCode,
      mapped_loinc: mapping?.loinc_code ?? null,
      mapped_test_name: mapping?.analyzer_name ?? null,
      value: typeof observation.value === "string" ? observation.value : null,
      unit: typeof observation.unit === "string" ? observation.unit : null,
      flags: observation.flags ?? {},
      instrument_flags: observation.instrumentFlags ?? {},
      status: mapping ? (stagingStatus === "MATCHED" ? "READY_FOR_REVIEW" : stagingStatus) : "UNMAPPED",
      correlation_id: correlationId,
    })
  }
  const { error: stageErr } = await db.from("lab_result_staging").insert(stagingRows)

  // Staging table optional until migration applied
  if (stageErr && !/does not exist|schema cache/i.test(stageErr.message ?? "")) {
    return NextResponse.json(
      {
        ok: true,
        messageId,
        staging: "skipped",
        warning: stageErr.message,
        correlationId,
        match: stagingStatus,
      },
      { status: 202 },
    )
  }

  return NextResponse.json({
    ok: true,
    messageId,
    correlationId,
    match: stagingStatus,
    labOrderId,
    note:
      stagingStatus === "UNMATCHED"
        ? "Raw message stored. Result staged as UNMATCHED — no patient assignment."
        : "Raw message stored and matched to accession. Awaiting human review — not released.",
  })
}
