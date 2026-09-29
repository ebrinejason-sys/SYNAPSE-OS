"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "../../../lib/supabase/server";
import { requirePlatformAccess } from "../../../lib/platform/auth";

export async function updateApplicationStatus(formData: FormData) {
  await requirePlatformAccess("platform.crm.manage");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "new");
  if (!id) return;

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any).from("hospital_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/platform/applications");
  revalidatePath("/platform");
}

export async function updateLeadStatus(formData: FormData) {
  await requirePlatformAccess("platform.crm.manage");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "new");
  if (!id) return;

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any).from("professional_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/platform/applications");
  revalidatePath("/platform");
}
