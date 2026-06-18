import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const batchId = form.get("batchId") as string;
  const file = form.get("file") as File | null;
  if (!batchId || !file) {
    return NextResponse.json({ error: "batchId and file required" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim());
  const headerLine = lines[0] ?? "";
  const dataLines = lines.slice(1);
  const totalRows = dataLines.length;
  const headers = headerLine.split(",").map((h) => h.trim());

  const supabase = createServiceClient();
  await (supabase as any)
    .from("import_batches")
    .update({ total_rows: totalRows, status: "uploaded" })
    .eq("id", batchId);

  const rows = dataLines.slice(0, 10).map((line, i) => ({
    batch_id: batchId,
    row_number: i + 1,
    entity: "patient",
    source_record: Object.fromEntries(
      headers.map((h, j) => [h, (line.split(",")[j] ?? "").trim()])
    ),
    status: "pending",
  }));

  if (rows.length > 0) {
    await (supabase as any).from("import_batch_rows").insert(rows);
  }

  return NextResponse.json({
    totalRows,
    validRows: totalRows,
    errorRows: 0,
    previewRows: rows.slice(0, 10),
  });
}
