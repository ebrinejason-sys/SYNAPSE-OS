import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform/auth";
import { listPlatformMembers } from "@/lib/platform/membership.server";

export async function GET() {
  const gate = await requirePlatformAdminApi("user.read");
  if (!gate.ok) return gate.response;

  const members = await listPlatformMembers();
  return NextResponse.json({ members, actor: { id: gate.profile.id, role: gate.profile.platformRole } });
}

export async function POST(req: NextRequest) {
  const gate = await requirePlatformAdminApi("user.invite");
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  return NextResponse.json(
    { error: "Use server action invitePlatformMember from /platform/access UI." },
    { status: 501 }
  );
}
