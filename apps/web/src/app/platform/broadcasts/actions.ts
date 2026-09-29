"use server";

import { Resend } from "resend";
import { requirePlatformAccess } from "../../../lib/platform/auth";
import { createServiceClient } from "../../../lib/supabase/server";
import { logPlatformEvent } from "../_lib/platform-data";
import { FROM_ADDRESS, brandedHtml } from "@synapse/email";

const ALLOWED_SCOPES = new Set(["all", "role"]);
const ALLOWED_ROLES = new Set(["pharmacy_admin", "pharmacy_staff", "platform_admin"]);

// ---------------------------------------------------------------------------
// Email broadcast
// ---------------------------------------------------------------------------

function buildEmailHtml(subject: string, body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return brandedHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#F5F5F7;">${subject}</h2>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#C0C0D0;">${escaped}</p>
    <p style="margin:24px 0 0;font-size:12px;color:#60607A;">
      This message was sent to you by a Synapse OS platform administrator.
    </p>
  `);
}

export async function sendEmailBroadcast(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const admin = await requirePlatformAccess("platform.crm.manage");

  const scope = String(formData.get("scope") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!ALLOWED_SCOPES.has(scope)) return { ok: false, message: "Invalid target scope." };
  if (scope === "role" && !ALLOWED_ROLES.has(role)) return { ok: false, message: "Invalid role." };
  if (!subject) return { ok: false, message: "Subject is required." };
  if (!body) return { ok: false, message: "Message body is required." };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY is not configured." };

  const db = createServiceClient() as any;

  // Fetch matching emails
  let query = db.from("profiles").select("email").not("email", "is", null);
  if (scope === "role") {
    query = query.eq("role", role);
  }
  const { data, error } = await query.limit(5000);
  if (error) return { ok: false, message: `Failed to fetch users: ${error.message}` };

  const emails: string[] = (data ?? [])
    .map((row: { email: string | null }) => row.email)
    .filter((e: string | null): e is string => Boolean(e));

  if (emails.length === 0) {
    return { ok: false, message: "No users with email addresses found for the selected audience." };
  }

  const html = buildEmailHtml(subject, body);
  const resend = new Resend(apiKey);

  // Resend supports up to 100 recipients per batch send
  const BATCH_SIZE = 100;
  const batches: string[][] = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE));
  }

  let sentCount = 0;
  let failCount = 0;

  for (const batch of batches) {
    try {
      // Resend batch API — sends individual emails to each recipient
      const results = await Promise.allSettled(
        batch.map((to) =>
          resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject,
            html,
          })
        )
      );
      const batchSent = results.filter((r) => r.status === "fulfilled").length;
      sentCount += batchSent;
      failCount += batch.length - batchSent;
    } catch {
      failCount += batch.length;
    }
  }

  await logPlatformEvent({
    actorId: admin.id,
    action: "BROADCAST_EMAIL",
    entityType: "profiles",
    metadata: {
      scope,
      role: scope === "role" ? role : null,
      subject,
      recipient_count: sentCount,
      failed_count: failCount,
    },
  });

  if (failCount > 0 && sentCount === 0) {
    return { ok: false, message: `Failed to send all ${failCount} emails. Check RESEND_API_KEY and sending limits.` };
  }
  if (failCount > 0) {
    return { ok: true, message: `Sent ${sentCount} emails. ${failCount} failed — check Resend dashboard.` };
  }
  return { ok: true, message: `Email sent to ${sentCount} recipient${sentCount !== 1 ? "s" : ""}.` };
}

// ---------------------------------------------------------------------------
// SMS broadcast (Africa's Talking raw HTTPS — no SDK dependency on web)
// ---------------------------------------------------------------------------

export async function sendSmsBroadcast(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const admin = await requirePlatformAccess("platform.crm.manage");

  const scope = String(formData.get("scope") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const smsBody = String(formData.get("body") ?? "").trim().slice(0, 160);

  if (!ALLOWED_SCOPES.has(scope)) return { ok: false, message: "Invalid target scope." };
  if (scope === "role" && !ALLOWED_ROLES.has(role)) return { ok: false, message: "Invalid role." };
  if (!smsBody) return { ok: false, message: "Message is required." };

  const atKey = process.env.AFRICAS_TALKING_API_KEY;
  const atUsername = process.env.AFRICAS_TALKING_USERNAME;
  const atSenderId = process.env.AFRICAS_TALKING_SENDER_ID;

  if (!atKey || !atUsername) {
    return { ok: false, message: "Africa's Talking credentials are not configured (AFRICAS_TALKING_API_KEY / AFRICAS_TALKING_USERNAME)." };
  }

  const db = createServiceClient() as any;

  // Check whether profiles has a phone column by selecting it
  let query = db.from("profiles").select("phone").not("phone", "is", null);
  if (scope === "role") {
    query = query.eq("role", role);
  }
  const { data, error } = await query.limit(5000);

  if (error) {
    // If the column doesn't exist, Supabase returns an error
    const msg = error.message ?? "";
    if (msg.includes("column") && msg.includes("phone")) {
      return {
        ok: false,
        message:
          "The profiles table does not have a phone column. Run a migration (ALTER TABLE profiles ADD COLUMN phone text) and collect phone numbers to enable SMS.",
      };
    }
    return { ok: false, message: `Failed to fetch users: ${msg}` };
  }

  const phones: string[] = (data ?? [])
    .map((row: { phone: string | null }) => row.phone)
    .filter((p: string | null): p is string => Boolean(p));

  if (phones.length === 0) {
    return { ok: false, message: "No users with phone numbers found for the selected audience." };
  }

  // Africa's Talking REST API — https://api.africastalking.com/version1/messaging
  const atEndpoint = "https://api.africastalking.com/version1/messaging";

  // AT accepts comma-separated recipients (max ~1000 per request)
  const BATCH_SIZE = 200;
  let sentCount = 0;
  let failCount = 0;

  for (let i = 0; i < phones.length; i += BATCH_SIZE) {
    const batch = phones.slice(i, i + BATCH_SIZE);
    const payload = new URLSearchParams({
      username: atUsername,
      to: batch.join(","),
      message: smsBody,
      ...(atSenderId ? { from: atSenderId } : {}),
    });

    try {
      const res = await fetch(atEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: atKey,
        },
        body: payload.toString(),
      });
      const json = (await res.json()) as {
        SMSMessageData?: { Recipients?: Array<{ status: string }> };
      };
      const recipients = json?.SMSMessageData?.Recipients ?? [];
      const batchSent = recipients.filter((r) => r.status === "Success").length;
      sentCount += batchSent;
      failCount += batch.length - batchSent;
    } catch {
      failCount += batch.length;
    }
  }

  await logPlatformEvent({
    actorId: admin.id,
    action: "BROADCAST_SMS",
    entityType: "profiles",
    metadata: {
      scope,
      role: scope === "role" ? role : null,
      message_length: smsBody.length,
      recipient_count: sentCount,
      failed_count: failCount,
    },
  });

  if (failCount > 0 && sentCount === 0) {
    return { ok: false, message: `SMS delivery failed for all ${failCount} numbers. Check Africa's Talking dashboard.` };
  }
  if (failCount > 0) {
    return { ok: true, message: `SMS sent to ${sentCount} recipients. ${failCount} failed — check Africa's Talking dashboard.` };
  }
  return { ok: true, message: `SMS sent to ${sentCount} recipient${sentCount !== 1 ? "s" : ""}.` };
}
