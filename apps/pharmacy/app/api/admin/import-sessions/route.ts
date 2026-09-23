import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { adapterFor } from "@synapse/db"
import Papa from "papaparse"
import * as XLSX from "xlsx"

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  name: [/^name$/i, /drug/i, /medicine/i, /product/i, /item/i, /stock.?item/i],
  generic_name: [/generic/i, /ingredient/i],
  category: [/category/i, /class/i, /^group$/i, /^under$/i],
  sku: [/sku/i, /code/i, /item.?no/i],
  barcode: [/barcode/i, /ean/i],
  quantity: [/qty/i, /quantity/i, /stock/i, /units/i, /closing.?stock/i],
  price: [/selling/i, /sale/i, /retail/i, /^price$/i, /^mrp$/i, /^rate$/i],
  cost_price: [/cost/i, /buying/i, /purchase/i, /wholesale/i],
  expiry_date: [/exp/i, /expiry/i, /expire/i, /best.?before/i],
  batch_number: [/batch/i, /lot/i],
  manufacturer: [/manufacturer/i, /maker/i, /brand/i],
  unit_of_measure: [/unit/i, /uom/i, /pack/i],
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

function headersFromRows(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return []
  return Object.keys(rows[0] ?? {})
}

async function parseUpload(file: File): Promise<{
  headers: string[]
  sampleRows: string[][]
  totalRows: number
  discoverySummary: string
}> {
  const fileName = file.name
  const lower = fileName.toLowerCase()
  let rows: Record<string, unknown>[] = []

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error("No sheets found in Excel file")
    const worksheet = workbook.Sheets[sheetName]
    rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as Record<string, unknown>[]
  } else if (lower.endsWith(".json")) {
    const text = await file.text()
    const value = JSON.parse(text) as Record<string, unknown>
    const data = Array.isArray(value.data)
      ? value.data
      : Array.isArray(value.rows)
        ? value.rows
        : Array.isArray(value)
          ? value
          : []
    rows = data as Record<string, unknown>[]
  } else {
    const text = await file.text()
    const results = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    })
    rows = results.data
  }

  const headers = headersFromRows(rows)
  const sampleRows = rows.map((row) => headers.map((h) => String(row[h] ?? "")))

  let discoverySummary = `Detected ${rows.length} data row(s) and ${headers.length} column(s).`
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const discovery = adapterFor(fileName, file.type).analyse(bytes, fileName, file.type)
    const warningText = discovery.warnings.length ? ` Warnings: ${discovery.warnings.join(", ")}.` : ""
    discoverySummary = `Format ${discovery.format}${discovery.company ? ` · ${discovery.company}` : ""} · ${
      discovery.counts.rows ?? rows.length
    } rows.${warningText}`
  } catch {
    // Keep spreadsheet discovery summary when adapter rejects (e.g. xlsx-only path).
  }

  return { headers, sampleRows, totalRows: rows.length, discoverySummary }
}

export async function GET() {
  try {
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { tenantId } = auth

    const { data, error } = await (supabaseAdmin as any)
      .from("pharmacy_import_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
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
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const contentType = request.headers.get("content-type") ?? ""
    let sourceSystem = "Unknown"
    let fileName = "Manual mapping session"
    let headers: string[] = []
    let sampleRows: string[][] = []
    let totalRows = 0
    let discoverySummary = ""

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      const file = form.get("file")
      sourceSystem = String(form.get("sourceSystem") ?? "Tally")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "File is required" }, { status: 400 })
      }
      fileName = file.name
      const parsed = await parseUpload(file)
      headers = parsed.headers
      sampleRows = parsed.sampleRows
      totalRows = parsed.totalRows
      discoverySummary = parsed.discoverySummary
    } else {
      const body = await request.json()
      sourceSystem = body.sourceSystem || "Unknown"
      fileName = body.fileName || "Manual mapping session"
      headers = Array.isArray(body.headers) ? body.headers.map(String).filter(Boolean) : []
      sampleRows = Array.isArray(body.sampleRows) ? body.sampleRows.slice(0, 20) : []
      totalRows = Number(body.totalRows ?? sampleRows.length)
    }

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
        tenant_id: tenantId,
        source_system: sourceSystem,
        file_name: fileName,
        status: "review",
        total_rows: totalRows,
        matched_rows: matchedRows,
        flagged_rows: flaggedRows,
        duplicate_rows: 0,
        ai_mapping: { mapping, sampleRows, engine: "heuristic_mapper_v1", discoverySummary },
        ai_summary: summary,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { session: data, mapping, summary, headers, discoverySummary, sampleRows },
      { status: 201 },
    )
  } catch (error) {
    console.error("Import sessions POST error:", error)
    const message = error instanceof Error ? error.message : "Failed to analyse import file"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { tenantId } = auth

    const body = await request.json().catch(() => ({}))
    const status = typeof body.status === "string" ? body.status : "applied"
    const fileName = typeof body.fileName === "string" ? body.fileName : null
    const summary =
      body.importedCount != null ? `Applied: ${body.importedCount} row(s) imported.` : undefined

    const { data: latest } = await (supabaseAdmin as any)
      .from("pharmacy_import_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Prefer matching file name when provided
    let sessionId = latest?.id as string | undefined
    if (fileName) {
      const { data: byName } = await (supabaseAdmin as any)
        .from("pharmacy_import_sessions")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("file_name", fileName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (byName?.id) sessionId = byName.id
    }

    if (!sessionId) return NextResponse.json({ success: true, updated: false })

    const { error } = await (supabaseAdmin as any)
      .from("pharmacy_import_sessions")
      .update({ status, ...(summary ? { ai_summary: summary } : {}) })
      .eq("id", sessionId)
      .eq("tenant_id", tenantId)

    if (error) throw error
    return NextResponse.json({ success: true, updated: true })
  } catch (error) {
    console.error("Import sessions PATCH error:", error)
    return NextResponse.json({ error: "Failed to update import session" }, { status: 500 })
  }
}
