import { NextResponse } from "next/server";

/**
 * Simple health check endpoint.
 * Used by the desktop sync client to check if the cloud is reachable.
 */
export async function GET() {
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
