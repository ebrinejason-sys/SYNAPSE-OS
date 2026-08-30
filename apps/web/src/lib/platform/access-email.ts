import { brandedHtml, FROM_ADDRESS } from "@synapse/email";
import { getResend } from "@/lib/resend";
import { roleLabel, type PlatformRole } from "./rbac";

async function sendPlatformEmail(to: string, subject: string, bodyHtml: string) {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html: brandedHtml(bodyHtml),
  });
}

export async function sendPlatformInviteEmail(params: {
  email: string;
  name: string;
  role: PlatformRole;
  inviteUrl: string;
}) {
  const subject = "You have been invited to observe SYNAPSE";
  const html = `
    <h2 style="color:#F5F5F7;font-size:20px;">SYNAPSE Platform Access</h2>
    <p style="color:#A0A0B0;line-height:1.7;">
      Hello ${params.name},<br/>
      You have been invited to the SYNAPSE governance portal as
      <strong style="color:#F97316;">${roleLabel(params.role)}</strong>.
    </p>
    <p style="color:#A0A0B0;line-height:1.7;">
      Accept the invitation to set your password and access read-only platform performance,
      deployments, test results, and milestones — without clinical PHI or production mutation rights.
    </p>
    <a href="${params.inviteUrl}" style="display:inline-block;background:#F97316;color:#07070A;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
      Accept Invitation →
    </a>
    <p style="color:#60607A;font-size:12px;margin-top:16px;">This link is single-use and expires in 72 hours.</p>
  `;
  await sendPlatformEmail(params.email, subject, html);
}

export async function sendPlatformRoleChangedEmail(params: {
  email: string;
  name: string;
  role: PlatformRole;
}) {
  const subject = "Your SYNAPSE platform role changed";
  const html = `
    <h2 style="color:#F5F5F7;font-size:20px;">Platform role updated</h2>
    <p style="color:#A0A0B0;line-height:1.7;">
      Hello ${params.name}, your SYNAPSE platform access role is now
      <strong style="color:#F97316;">${roleLabel(params.role)}</strong>.
    </p>
    <p style="color:#60607A;font-size:12px;">If you did not expect this change, contact your platform administrator immediately.</p>
  `;
  await sendPlatformEmail(params.email, subject, html);
}

export async function sendPlatformSuspendedEmail(params: { email: string; name: string }) {
  const subject = "Your SYNAPSE platform access was suspended";
  const html = `
    <h2 style="color:#F5F5F7;font-size:20px;">Platform access suspended</h2>
    <p style="color:#A0A0B0;line-height:1.7;">
      Hello ${params.name}, your access to admin.synapseos.tech has been suspended.
      Contact your platform administrator if you believe this is an error.
    </p>
  `;
  await sendPlatformEmail(params.email, subject, html);
}
