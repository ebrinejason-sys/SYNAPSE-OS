import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "../supabase/server";

type PlatformAdminProfile = {
  id: string;
  role: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export async function requirePlatformAdmin(): Promise<PlatformAdminProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/platform/login");
  }

  const supabaseAdmin = createServiceClient();
  const { data: profile } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, role, full_name, avatar_url, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "platform_admin") {
    redirect("/platform/login");
  }

  return profile as PlatformAdminProfile;
}
