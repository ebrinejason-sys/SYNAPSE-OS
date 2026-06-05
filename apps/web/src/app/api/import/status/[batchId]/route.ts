import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../../lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const supabase = createServiceClient();
  const { data, error } = await (supabase as any)
    .from("import_batches")
    .select("status, total_rows, valid_rows, error_rows")
    .eq("id", batchId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const total = (data.total_rows as number) || 0;
  const done = ((data.valid_rows as number) || 0) + ((data.error_rows as number) || 0);
  return NextResponse.json({
    status: data.status,
    totalRows: total,
    validRows: data.valid_rows,
    errorRows: data.error_rows,
    progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
  });
}
