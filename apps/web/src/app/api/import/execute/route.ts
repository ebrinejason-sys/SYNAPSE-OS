import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  const { batchId } = await req.json() as { batchId: string };
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: batch } = await (supabase as any)
    .from("import_batches")
    .select("hospital_id, total_rows, tenant_id")
    .eq("id", batchId)
    .single();
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  await (supabase as any)
    .from("import_batches")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", batchId);

  const { data: rows } = await (supabase as any)
    .from("import_batch_rows")
    .select("id, source_record")
    .eq("batch_id", batchId)
    .eq("status", "pending")
    .limit(100);

  let imported = 0;
  let errored = 0;

  for (const row of rows ?? []) {
    const raw = row.source_record as Record<string, string>;
    const fullName =
      raw["full_name"] ?? raw["name"] ?? raw["patient_name"] ?? raw["Full Name"] ?? "";
    if (!fullName) {
      errored++;
      await (supabase as any)
        .from("import_batch_rows")
        .update({ status: "error", validation_errors: { message: "Missing full_name" } })
        .eq("id", row.id);
      continue;
    }
    const { error } = await (supabase as any).from("patients").insert({
      full_name: fullName,
      sex: raw["sex"] ?? raw["gender"] ?? null,
      date_of_birth: raw["date_of_birth"] ?? raw["dob"] ?? raw["DOB"] ?? null,
      hospital_id: batch.hospital_id,
      tenant_id: batch.tenant_id ?? null,
    });
    if (error) {
      errored++;
      await (supabase as any)
        .from("import_batch_rows")
        .update({ status: "error", validation_errors: { message: error.message } })
        .eq("id", row.id);
    } else {
      imported++;
      await (supabase as any)
        .from("import_batch_rows")
        .update({ status: "imported" })
        .eq("id", row.id);
    }
  }

  await (supabase as any)
    .from("import_batches")
    .update({
      status: "completed",
      valid_rows: imported,
      error_rows: errored,
      finished_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return NextResponse.json({ imported, errored });
}
