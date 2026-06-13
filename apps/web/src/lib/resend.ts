import { Resend } from 'resend'

let resendClient: Resend | null = null

export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  resendClient ??= new Resend(apiKey)
  return resendClient
}

export const resend = {
  emails: {
    send: (...args: Parameters<Resend['emails']['send']>) => getResend().emails.send(...args),
  },
}

export const NOTIFY_EMAILS = ['ebrinetushabe@gmail.com', 'nathandavid762@gmail.com']
export const FROM_EMAIL    = process.env.RESEND_FROM_EMAIL ?? 'noreply@synapseos.tech'
export const FROM_NAME     = 'Synapse OS'

/* Branded HTML wrapper.
 * Pass unsubscribeUrl for marketing emails (newsletter) — required by CAN-SPAM.
 * Omit for transactional emails (OTP, welcome, confirmation). */
export function brandedEmail({
  subject,
  body,
  unsubscribeUrl,
}: {
  subject: string
  body: string
  unsubscribeUrl?: string
}): string {
  const footer = unsubscribeUrl
    ? `<p style="margin:0 0 6px;font-size:12px;color:#60607A;">
        Synapse Health Technologies Ltd &middot; Ebrine's Residence, Buziga Hill, Katuuso Crescent, Kampala, Uganda<br/>
        <a href="https://synapseos.tech" style="color:#F97316;text-decoration:none;">synapseos.tech</a>
        &nbsp;&middot;&nbsp;
        <a href="mailto:hello@synapseos.tech" style="color:#60607A;text-decoration:none;">hello@synapseos.tech</a>
      </p>
      <p style="margin:0;font-size:11px;color:#40405A;">
        You're receiving this because you subscribed at synapseos.tech. &nbsp;
        <a href="${unsubscribeUrl}" style="color:#60607A;text-decoration:underline;">Unsubscribe</a>
      </p>`
    : `<p style="margin:0;font-size:12px;color:#60607A;">
        Synapse Health Technologies Ltd &middot; Ebrine's Residence, Buziga Hill, Katuuso Crescent, Kampala, Uganda<br/>
        <a href="https://synapseos.tech" style="color:#F97316;text-decoration:none;">synapseos.tech</a>
        &nbsp;&middot;&nbsp;
        <a href="mailto:hello@synapseos.tech" style="color:#60607A;text-decoration:none;">hello@synapseos.tech</a>
      </p>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#07070A;font-family:'DM Sans',Arial,sans-serif;color:#F5F5F7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07070A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111117;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;max-width:600px;">
          <!-- Top gradient bar -->
          <tr><td style="background:linear-gradient(135deg,#F97316,#E8B84B);padding:4px 0;"></td></tr>
          <!-- Header + body -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <div style="margin-bottom:24px;">
                <img src="https://synapseos.tech/assets/logos/synapse-logo.png" alt="Synapse OS" width="40" height="40"
                  style="border-radius:9px;display:inline-block;vertical-align:middle;margin-right:10px;" />
                <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle;">
                  <span style="color:#F97316;">Synapse</span><span style="color:#E8B84B;">OS</span>
                </span>
              </div>
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/* Transactional: OTP verification code email */
export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [email],
    subject: `${otp} — Your Synapse OS verification code`,
    html: brandedEmail({
      subject: `Your Synapse OS verification code`,
      body: `
        <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#F5F5F7;">Your verification code</h2>
        <p style="font-size:14px;line-height:1.6;color:#A0A0B0;margin:0 0 28px;">
          Use this code to sign in to Synapse OS. It expires in <strong style="color:#F5F5F7;">10 minutes</strong>.
        </p>
        <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:12px;padding:28px 20px;text-align:center;margin-bottom:28px;">
          <span style="font-family:'JetBrains Mono',monospace,Courier;font-size:42px;font-weight:700;letter-spacing:0.25em;color:#F97316;">${otp}</span>
        </div>
        <p style="font-size:13px;color:#60607A;margin:0;">
          Never share this code. Synapse OS will never ask for it by phone or chat.<br/>
          If you didn't request this, you can safely ignore this email.
        </p>
      `,
    }),
  })
}

/* Transactional: welcome email after successful onboarding */
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const firstName = name.split(' ')[0]
  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [email],
    subject: `Welcome to Synapse OS, ${firstName}`,
    html: brandedEmail({
      subject: `Welcome to Synapse OS`,
      body: `
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F5F5F7;">
          Welcome, ${firstName}. Your account is ready.
        </h2>
        <p style="font-size:15px;line-height:1.7;color:#A0A0B0;margin:0 0 20px;">
          You've successfully joined Synapse OS — Africa's sovereign AI-powered health platform.
          Your hospital's clinical workflows, records, and analytics are now at your fingertips.
        </p>
        <a href="https://synapseos.tech/health/dashboard"
          style="display:inline-block;background:#F97316;color:#07070A;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;">
          Open Dashboard →
        </a>
      `,
    }),
  })
}

/* Transactional: pharmacy admin invite — sent on enrollment */
export async function sendPharmacyInviteEmail({
  to,
  pharmacyName,
  adminName,
  inviteToken,
}: {
  to: string
  pharmacyName: string
  adminName: string
  inviteToken: string
}): Promise<void> {
  const pharmacyAppUrl = process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? "https://pharm.synapseos.tech"
  const inviteUrl = `${pharmacyAppUrl.replace(/\/$/, "")}/invite/${inviteToken}`
  const firstName = adminName.split(' ')[0] || 'there'
  await resend.emails.send({
    from: `Synapse Health <${FROM_EMAIL}>`,
    to: [to],
    subject: `You've been enrolled on Synapse Pharmacy — ${pharmacyName}`,
    html: brandedEmail({
      subject: `You've been enrolled on Synapse Pharmacy`,
      body: `
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#F5F5F7;">
          Welcome to Synapse Pharmacy, ${firstName}.
        </h2>
        <p style="font-size:14px;line-height:1.7;color:#A0A0B0;margin:0 0 8px;">
          <strong style="color:#F5F5F7;">${pharmacyName}</strong> has been enrolled on
          Synapse Health Technologies. You are the pharmacy administrator.
        </p>
        <p style="font-size:14px;line-height:1.7;color:#A0A0B0;margin:0 0 24px;">
          Click below to set up your account and get started.
        </p>
        <a href="${inviteUrl}"
          style="display:inline-block;background:#F97316;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
          Set Up Your Account →
        </a>
        <p style="font-size:12px;color:#60607A;margin:20px 0 0;">
          This link expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
      `,
    }),
  })
}

/* Transactional: waitlist confirmation for APK download */
export async function sendWaitlistEmail(email: string): Promise<void> {
  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [email],
    subject: "You're on the Synapse OS app waitlist",
    html: brandedEmail({
      subject: "You're on the Synapse OS app waitlist",
      body: `
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F5F5F7;">You're on the list.</h2>
        <p style="font-size:15px;line-height:1.7;color:#A0A0B0;margin:0 0 16px;">
          We'll notify you as soon as the Synapse OS mobile app is available for download.
          You'll be among the first to access real-time clinical tools on mobile.
        </p>
        <a href="https://synapseos.tech"
          style="display:inline-block;background:rgba(255,255,255,0.08);color:#F5F5F7;font-weight:600;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none;border:1px solid rgba(255,255,255,0.12);">
          Learn more at synapseos.tech
        </a>
      `,
    }),
  })
}
