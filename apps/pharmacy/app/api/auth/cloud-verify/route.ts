import { NextResponse } from "next/server";

/**
 * Cloud Verification Endpoint — DISABLED
 *
 * This legacy desktop-sync endpoint has been removed as part of the
 * Prisma → Supabase migration. Desktop clients should use Supabase Auth directly.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, message: "Cloud verify is disabled" },
    { status: 410 }
  );
}
