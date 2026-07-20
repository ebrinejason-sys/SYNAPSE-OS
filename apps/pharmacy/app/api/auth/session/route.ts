import { NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"

/** Soft session probe — returns null when unauthenticated (no 401). */
export async function GET() {
  const session = await getPharmacySession()
  return NextResponse.json(session)
}
