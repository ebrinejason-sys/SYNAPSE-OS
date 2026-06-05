import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase/server";
import { checkRateLimit, rateLimiters } from "../../../../lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(rateLimiters.import, ip);
  if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { hospitalId, sourceType, sourceName, importScope } = await req.json() as {
    hospitalId: string;
    sourceType: string;
    sourceName: string;
    importScope: string;
  };

  const supabase = createServiceClient();
  const { data, error } = await (supabase as any)
    .from("import_batches")
    .insert({
      hospital_id: hospitalId,
      source_type: sourceType,
      source_name: sourceName,
      import_scope: importScope,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batchId: data.id });
}
