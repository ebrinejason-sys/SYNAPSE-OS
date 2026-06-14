import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, hasPermission, isPharmacyAdmin } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  name: [/^name$/i, /drug/i, /medicine/i, /product/i, /item/i],
  generic_name: [/generic/i, /ingredient/i],
  category: [/category/i, /class/i],
  sku: [/sku/i, /code/i, /item.?no/i],
  barcode: [/barcode/i, /ean/i],
  quantity: [/qty/i, /quantity/i, /stock/i, /units/i],
  price: [/selling/i, /sale/i, /retail/i, /^price$/i],
  cost_price: [/cost/i, /buying/i, /purchase/i, /wholesale/i],
  expiry_date: [/exp/i, /expiry/i, /expire/i, /best.?before/i],
  batch_number: [/batch/i, /lot/i],
  manufacturer: [/manufacturer/i, /maker/i, /brand/i],
  unit_of_measure: [/unit/i, /uom/i, /pack/i],
}

function canImport(session: NonNullable<Awaited<ReturnType<typeof getPharmacySession>>>) {
  return isPharmacyAdmin(session) || hasPermission(session, "MANAGE_INVENTORY")
}

function mapHeaders(headers: string[]) {
  return headers.map((header) => {
    const normalized = header.trim()
    let bestField = ""
    let confidence = 0

    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      const score = patterns.some((pattern) => pattern.test(normalized)) ? 0.9 : 0
      if (score > confidence) {
        bestField = field
        confidence = score
      }
    }

    return {
      source: normalized,
      target: bestField || "unmapped",
      confidence: bestField ? confidence : 0.2,
      status: bestField ? "mapped" : "needs_review",
    }
  })
}

export async function GET() {
  try {
    const session = await getPharmacySession()
    if (!session || !canImport(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await (supabaseAdmin as any)
      .from("pharmacy_import_sessions")
      .select("*")
      .eq("tenant_id", session.profile.tenant_id!)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("Import sessions GET error:", error)
    return NextResponse.json({ error: "Failed to fetch import sessions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session || !canImport(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const headers = Array.isArray(body.headers) ? body.headers.map(String).filter(Boolean) : []
    const sampleRows = Array.isArray(body.sampleRows) ? body.sampleRows.slice(0, 20) : []

    if (headers.length === 0) {
      return NextResponse.json({ error: "At least one header is required" }, { status: 400 })
    }

    const mapping = mapHeaders(headers)
    const flaggedRows = mapping.filter((item) => item.status === "needs_review").length
    const matchedRows = mapping.length - flaggedRows
    const summary =
      flaggedRows === 0
        ? "All supplied columns were mapped with high confidence."
        : `${flaggedRows} column${flaggedRows === 1 ? "" : "s"} need review before import.`

    const { data, error } = await supabaseAdmin
      .from("pharmacy_import_sessions")
      .insert({
        tenant_id: session.profile.tenant_id!,
        source_system: body.sourceSystem || "Unknown",
        file_name: body.fileName || "Manual mapping session",
        status: "review",
        total_rows: Number(body.totalRows ?? sampleRows.length),
        matched_rows: matchedRows,
        flagged_rows: flaggedRows,
        duplicate_rows: 0,
        ai_mapping: { mapping, sampleRows, engine: "heuristic_mapper_v1" },
        ai_summary: summary,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ session: data, mapping, summary }, { status: 201 })
  } catch (error) {
    console.error("Import sessions POST error:", error)
    return NextResponse.json({ error: "Failed to analyse import file" }, { status: 500 })
  }
}
