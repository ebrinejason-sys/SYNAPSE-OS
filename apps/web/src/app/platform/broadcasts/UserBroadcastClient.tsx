"use client";

import { useRef, useState, useTransition } from "react";
import { Mail, MessageSquare, Send, Users } from "lucide-react";
import type { sendEmailBroadcast, sendSmsBroadcast } from "./actions";

type Props = {
  roleCounts: Record<string, number>;
  totalUsers: number;
  hasPhoneColumn: boolean;
  sendEmail: typeof sendEmailBroadcast;
  sendSms: typeof sendSmsBroadcast;
};

type Tab = "email" | "sms";

type TargetScope = "all" | "role";
const ROLES = ["pharmacy_admin", "pharmacy_staff", "platform_admin"] as const;
type Role = (typeof ROLES)[number];

function recipientCount(
  scope: TargetScope,
  selectedRole: Role | "",
  roleCounts: Record<string, number>,
  totalUsers: number
): number {
  if (scope === "all") return totalUsers;
  if (scope === "role" && selectedRole) return roleCounts[selectedRole] ?? 0;
  return 0;
}

export function UserBroadcastClient({ roleCounts, totalUsers, hasPhoneColumn, sendEmail, sendSms }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("email");

  // Email state
  const [emailScope, setEmailScope] = useState<TargetScope>("all");
  const [emailRole, setEmailRole] = useState<Role | "">("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailResult, setEmailResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPendingEmail, startEmailTransition] = useTransition();

  // SMS state
  const [smsScope, setSmsScope] = useState<TargetScope>("all");
  const [smsRole, setSmsRole] = useState<Role | "">("");
  const [smsBody, setSmsBody] = useState("");
  const [smsResult, setSmsResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPendingSms, startSmsTransition] = useTransition();

  const emailCount = recipientCount(emailScope, emailRole, roleCounts, totalUsers);
  const smsCount = recipientCount(smsScope, smsRole, roleCounts, totalUsers);

  function handleSendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    const fd = new FormData();
    fd.set("scope", emailScope);
    fd.set("role", emailRole);
    fd.set("subject", emailSubject);
    fd.set("body", emailBody);
    setEmailResult(null);
    startEmailTransition(async () => {
      const result = await sendEmail(fd);
      setEmailResult(result);
    });
  }

  function handleSendSms() {
    if (!smsBody.trim()) return;
    const fd = new FormData();
    fd.set("scope", smsScope);
    fd.set("role", smsRole);
    fd.set("body", smsBody);
    setSmsResult(null);
    startSmsTransition(async () => {
      const result = await sendSms(fd);
      setSmsResult(result);
    });
  }

  const tabBtn = (tab: Tab) =>
    `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
      activeTab === tab
        ? "bg-[#F97316] text-white"
        : "border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
    }`;

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#F97316]";
  const labelCls = "block text-xs font-medium uppercase tracking-wide text-slate-500";
  const selectCls =
    "w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#F97316]";

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111117]">
      {/* Header + tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
        <div>
          <h2 className="text-sm font-semibold">Direct User Communications</h2>
          <p className="mt-1 text-xs text-slate-500">Compose and send email or SMS to platform users by role.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={tabBtn("email")} onClick={() => setActiveTab("email")}>
            <Mail className="h-4 w-4" />
            Email Users
          </button>
          <button type="button" className={tabBtn("sms")} onClick={() => setActiveTab("sms")}>
            <MessageSquare className="h-4 w-4" />
            SMS Users
          </button>
        </div>
      </div>

      {/* Email tab */}
      {activeTab === "email" && (
        <div className="grid gap-4 p-4 xl:grid-cols-[1fr_320px]">
          {/* Composer */}
          <div className="space-y-4">
            {/* Target */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Target audience
                <select
                  className={`mt-1 ${selectCls}`}
                  value={emailScope}
                  onChange={(e) => setEmailScope(e.target.value as TargetScope)}
                >
                  <option value="all">All users ({totalUsers})</option>
                  <option value="role">By role</option>
                </select>
              </label>
              {emailScope === "role" && (
                <label className={labelCls}>
                  Role
                  <select
                    className={`mt-1 ${selectCls}`}
                    value={emailRole}
                    onChange={(e) => setEmailRole(e.target.value as Role | "")}
                  >
                    <option value="">— pick a role —</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r} ({roleCounts[r] ?? 0})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* Recipient count */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#07070A] px-3 py-2">
              <Users className="h-4 w-4 text-[#E8B84B]" />
              <span className="text-sm text-slate-300">
                {emailCount > 0 ? (
                  <>
                    Sending to{" "}
                    <strong className="text-[#F97316]">{emailCount.toLocaleString()}</strong> recipient
                    {emailCount !== 1 ? "s" : ""}
                  </>
                ) : (
                  <span className="text-slate-500">Select a target audience above.</span>
                )}
              </span>
            </div>

            <label className={labelCls}>
              Subject
              <input
                type="text"
                className={`mt-1 ${inputCls}`}
                placeholder="e.g. Important update from Synapse OS"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                maxLength={200}
              />
            </label>

            <label className={labelCls}>
              Message body
              <textarea
                className={`mt-1 ${inputCls}`}
                rows={7}
                placeholder="Write your message here. Plain text — will be wrapped in the Synapse branded email template."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </label>

            {emailResult && (
              <p
                className={`rounded-lg border px-3 py-2 text-sm ${
                  emailResult.ok
                    ? "border-green-500/30 bg-green-500/10 text-green-300"
                    : "border-red-500/30 bg-red-500/10 text-red-300"
                }`}
              >
                {emailResult.message}
              </p>
            )}

            <button
              type="button"
              disabled={isPendingEmail || !emailSubject.trim() || !emailBody.trim() || emailCount === 0}
              onClick={handleSendEmail}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA6C0A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {isPendingEmail ? "Sending…" : `Send email to ${emailCount.toLocaleString()} recipient${emailCount !== 1 ? "s" : ""}`}
            </button>
          </div>

          {/* Preview pane */}
          <div className="rounded-xl border border-slate-800 bg-[#07070A] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            {emailSubject ? (
              <p className="mb-2 text-sm font-semibold text-slate-200">{emailSubject}</p>
            ) : (
              <p className="mb-2 text-sm italic text-slate-600">No subject yet</p>
            )}
            <div className="rounded-lg border border-slate-800 bg-[#111117] p-3">
              {emailBody ? (
                <p className="whitespace-pre-wrap text-xs text-slate-300">{emailBody}</p>
              ) : (
                <p className="text-xs italic text-slate-600">Your message will appear here.</p>
              )}
            </div>
            <p className="mt-3 text-[10px] text-slate-600">
              Delivered via Resend · Synapse branded template · noreply@synapseos.tech
            </p>
          </div>
        </div>
      )}

      {/* SMS tab */}
      {activeTab === "sms" && (
        <div className="p-4 space-y-4">
          {!hasPhoneColumn && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <strong>Phone numbers not available.</strong> The <code className="text-xs">profiles</code> table does
              not have a <code className="text-xs">phone</code> column. To enable SMS, run a migration to add{" "}
              <code className="text-xs">phone text</code> to the <code className="text-xs">profiles</code> table and
              collect phone numbers during signup. The form below is ready — SMS sending will activate once phone data
              is present.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Target audience
              <select
                className={`mt-1 ${selectCls}`}
                value={smsScope}
                onChange={(e) => setSmsScope(e.target.value as TargetScope)}
              >
                <option value="all">All users ({totalUsers})</option>
                <option value="role">By role</option>
              </select>
            </label>
            {smsScope === "role" && (
              <label className={labelCls}>
                Role
                <select
                  className={`mt-1 ${selectCls}`}
                  value={smsRole}
                  onChange={(e) => setSmsRole(e.target.value as Role | "")}
                >
                  <option value="">— pick a role —</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r} ({roleCounts[r] ?? 0})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#07070A] px-3 py-2">
            <Users className="h-4 w-4 text-[#E8B84B]" />
            <span className="text-sm text-slate-300">
              {smsCount > 0 ? (
                <>
                  Targeting{" "}
                  <strong className="text-[#F97316]">{smsCount.toLocaleString()}</strong> user
                  {smsCount !== 1 ? "s" : ""}
                  {!hasPhoneColumn && (
                    <span className="ml-2 text-amber-400">(no phone numbers on record)</span>
                  )}
                </>
              ) : (
                <span className="text-slate-500">Select a target audience above.</span>
              )}
            </span>
          </div>

          <label className={labelCls}>
            Message ({smsBody.length}/160)
            <textarea
              className={`mt-1 ${inputCls}`}
              rows={4}
              maxLength={160}
              placeholder="Max 160 characters (1 SMS credit). Will be sent from your Africa's Talking Sender ID."
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
            />
            <span className={`mt-1 block text-right text-[10px] ${smsBody.length > 140 ? "text-amber-400" : "text-slate-600"}`}>
              {160 - smsBody.length} characters remaining
            </span>
          </label>

          {smsResult && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                smsResult.ok
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {smsResult.message}
            </p>
          )}

          <button
            type="button"
            disabled={isPendingSms || !smsBody.trim() || smsCount === 0}
            onClick={handleSendSms}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA6C0A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {isPendingSms ? "Sending…" : `Send SMS to ${smsCount.toLocaleString()} user${smsCount !== 1 ? "s" : ""}`}
          </button>

          <p className="text-xs text-slate-600">
            Delivered via Africa&apos;s Talking · Sender ID: {process.env.NEXT_PUBLIC_AT_SENDER_ID ?? "(configured server-side)"}
          </p>
        </div>
      )}
    </div>
  );
}
