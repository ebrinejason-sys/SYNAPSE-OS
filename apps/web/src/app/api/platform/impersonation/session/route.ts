import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "../../../../../lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logPlatformEvent } from "../../../../platform/_lib/platform-data";

type ImpersonationSession = {
  userId: string;
  name: string;
  email: string;
  role: string;
  tenantId: string | null;
  startedAt: string;
  startedBy: string;
};

async function requireAdminUserId() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.role === "platform_admin" ? user.id : null;
}

function parseSession(value: string | undefined): ImpersonationSession | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as ImpersonationSession;
  } catch {
    return null;
  }
}

export async function GET() {
  const adminId = await requireAdminUserId();
  if (!adminId) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  const cookieStore = await cookies();
  const session = parseSession(cookieStore.get("synapse_impersonation")?.value);
  return NextResponse.json({ session });
}

export async function DELETE() {
  const adminId = await requireAdminUserId();
  if (!adminId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const cookieStore = await cookies();
  const session = parseSession(cookieStore.get("synapse_impersonation")?.value);
  if (session) {
    await logPlatformEvent({
      actorId: adminId,
      action: "impersonation.ended",
      entityType: "profile",
      entityId: session.userId,
      tenantId: session.tenantId,
      metadata: { impersonated_role: session.role, started_at: session.startedAt },
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("synapse_impersonation", "", { path: "/", maxAge: 0 });
  return response;
}
