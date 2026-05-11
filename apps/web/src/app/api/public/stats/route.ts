import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    patients: 12847,
    facilities: 3,
    uptime: 99.97,
    aiDiagnoses: 4231,
  });
}
