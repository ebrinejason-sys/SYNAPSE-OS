import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const NOTIFY_EMAILS = ['ebrinetushabe@gmail.com', 'nathandavid762@gmail.com']
export const FROM_EMAIL    = process.env.RESEND_FROM_EMAIL ?? 'noreply@synapseos.tech'
export const FROM_NAME     = 'Synapse OS'

/* Branded HTML wrapper for all outgoing emails */
export function brandedEmail({
  subject,
  body,
}: {
  subject: string
  body: string
}): string {
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
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111117;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#F97316,#E8B84B);padding:4px 0;"></td>
          </tr>
          <tr>
            <td style="padding:32px 40px 24px;">
              <div style="margin-bottom:24px;">
                <img src="https://synapseos.tech/synapse-logo.png" alt="Synapse OS" width="40" height="40" style="border-radius:9px;display:inline-block;vertical-align:middle;margin-right:10px;" />
                <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle;">
                  <span style="color:#F97316;">Synapse</span><span style="color:#E8B84B;">OS</span>
                </span>
              </div>
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:#60607A;">
                Synapse Health Technologies Ltd &middot; Ebrine's Residence, Buziga Hill, Katuuso Crescent, Kampala, Uganda<br/>
                <a href="https://synapseos.tech" style="color:#F97316;text-decoration:none;">synapseos.tech</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:hello@synapseos.tech" style="color:#60607A;text-decoration:none;">hello@synapseos.tech</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
