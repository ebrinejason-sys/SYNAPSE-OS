import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const SAFETY = "Synthetic demonstration data. No production healthcare writes."

const MAP: Record<string, { loinc: string; name: string }> = {
  WBC: { loinc: "6690-2", name: "White blood cells" },
  HGB: { loinc: "718-7", name: "Hemoglobin" },
  MALARIA: { loinc: "32286-7", name: "Malaria antigen" },
  "2345-7": { loinc: "2345-7", name: "Glucose" },
  "2160-0": { loinc: "2160-0", name: "Creatinine" },
}

function astmCbc(accession: string) {
  return [
    "H|\\^&|||SYNAPSE AST-100^SIMULATOR|||||P|1",
    `P|1||${accession}|||||||||||||||`,
    `O|1|${accession}||^^^WBC\\^^^HGB|R||||||N||||||||||||||F`,
    "R|1|^^^WBC|6.8|10*9/L||||N|||F",
    "R|2|^^^HGB|13.4|g/dL||||N|||F",
    "L|1|N",
  ].join("\r")
}

function hl7Chem(accession: string) {
  return [
    "MSH|^~\\&|SYNAPSE-CHEM|LAB|SYNAPSE|CORE|20260904120000||ORU^R01|SIM-1|P|2.5",
    `PID|1||${accession}||GOLDEN^TEST`,
    `OBR|1|${accession}|${accession}||CHEM^Chemistry panel|||20260904120000`,
    "OBX|1|NM|2345-7^Glucose^LN||5.2|mmol/L|3.9-6.1|N|||F",
    "OBX|2|NM|2160-0^Creatinine^LN||82|umol/L|60-110|N|||F",
  ].join("\r")
}

function astmMalaria(accession: string) {
  return [
    "H|\\^&|||SYNAPSE MALARIA-SIM|||||P|1",
    `O|1|${accession}||^^^MALARIA|R||||||N`,
    "R|1|^^^MALARIA|Positive||||A|||F",
    "L|1|N",
  ].join("\r")
}

function parseAstm(raw: string) {
  const records = raw.split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean)
  let accessionNumber: string | undefined
  const results: Array<{ analyzerCode: string; value: string; unit?: string; accessionNumber?: string }> = []
  for (const record of records) {
    const fields = record.split("|")
    if (fields[0] === "O") accessionNumber = fields[2]
    if (fields[0] === "R") {
      const analyzerCode = fields[2]?.split("^").filter(Boolean).pop() ?? ""
      const value = fields[3] ?? ""
      if (analyzerCode && value) results.push({ analyzerCode, value, unit: fields[4] || undefined, accessionNumber })
    }
  }
  return results
}

function parseHl7(raw: string) {
  const segments = raw.split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean)
  let accessionNumber: string | undefined
  const results: Array<{ analyzerCode: string; value: string; unit?: string; accessionNumber?: string }> = []
  for (const segment of segments) {
    const fields = segment.split("|")
    if (fields[0] === "OBR") accessionNumber = fields[3] || fields[2]
    if (fields[0] === "OBX") {
      const analyzerCode = fields[3]?.split("^")[0] ?? ""
      const value = fields[5] ?? ""
      if (analyzerCode && value) results.push({ analyzerCode, value, unit: fields[6] || undefined, accessionNumber })
    }
  }
  return results
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { panel?: string; accession?: string }
  const accession = body.accession?.trim() || "DEMO-ACC-0001"
  const panel = body.panel === "chemistry" ? "chemistry" : body.panel === "malaria" ? "malaria" : "fbc"
  const raw = panel === "chemistry" ? hl7Chem(accession) : panel === "malaria" ? astmMalaria(accession) : astmCbc(accession)
  const parsed = panel === "chemistry" ? parseHl7(raw) : parseAstm(raw)
  const staging = parsed.map((row) => {
    const mapped = MAP[row.analyzerCode]
    return {
      analyzerCode: row.analyzerCode,
      value: row.value,
      unit: row.unit,
      accessionNumber: row.accessionNumber,
      mappedLoinc: mapped?.loinc ?? null,
      mappedTest: mapped?.name ?? null,
      status: mapped ? "READY_FOR_REVIEW" : "UNMAPPED",
    }
  })
  return NextResponse.json({
    ok: true,
    isolated: true,
    productionWrites: false,
    label: SAFETY,
    panel,
    raw,
    parsed,
    staging,
    note: "AI may analyse this synthetic staging row. A Lab Scientist must still verify and release.",
  })
}
