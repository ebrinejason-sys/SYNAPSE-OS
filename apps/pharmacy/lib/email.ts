import { Resend } from 'resend'
import { randomBytes } from 'crypto'

// Lazy instance --- avoids throwing at module load time when key is absent
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
  }
  return _resend
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@synapseos.tech'
    const data = await getResend().emails.send({
      from: `SYNAPSE Pharm <${fromEmail}>`,
      to,
      subject,
      html,
    })
    return { success: true, data }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { success: false, error }
  }
}

export function generateWelcomeEmail(name: string, email: string, password: string, role: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
        .credentials { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to SYNAPSE Pharm</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Your account has been created successfully. You can now access the SYNAPSE Pharm POS system.</p>
          
          <div class="credentials">
            <h3>Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${password}</p>
            <p><strong>Role:</strong> ${role}</p>
          </div>
          
          <p><strong>Important:</strong> For security reasons, you will be required to change your password upon first login.</p>
          
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" class="button">Login to Your Account</a>
          
          <p style="margin-top: 30px;">If you have any questions or need assistance, please contact your administrator.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} SYNAPSE Pharm. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function generatePasswordResetEmail(name: string, resetLink: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>

          <a href="${resetLink}" class="button">Reset Password</a>

          <p style="margin-top: 30px;">If you didn't request this password reset, please ignore this email.</p>
          <p><small>This link will expire in 1 hour.</small></p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} SYNAPSE Pharm. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function generateTempPassword(length = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*'
  const all = uppercase + lowercase + numbers + symbols

  let password = ''
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)]
  }

  return password
    .split('')
    .sort(() => randomBytes(1)[0] - 128)
    .join('')
}

function generatePharmacyInviteEmailHtml({
  pharmacyName,
  adminName,
  inviteToken,
}: {
  pharmacyName: string
  adminName: string
  inviteToken: string
}): string {
  const pharmacyAppUrl = process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? "https://pharm.synapseos.tech"
  const inviteUrl = `${pharmacyAppUrl.replace(/\/$/, "")}/invite/${inviteToken}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #E4E4E7;
          margin: 0;
          padding: 0;
          background-color: #07070A;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .card {
          background-color: #111117;
          border: 1px solid #2A2A36;
          border-radius: 8px;
          padding: 40px;
          margin: 20px 0;
        }
        .logo-section {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo-square {
          width: 60px;
          height: 60px;
          background-color: #F97316;
          border-radius: 8px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 24px;
          color: #111117;
        }
        h1 {
          color: #F97316;
          text-align: center;
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .subtitle {
          text-align: center;
          color: #A1A1A1;
          font-size: 14px;
          margin-bottom: 30px;
        }
        .content-section {
          margin: 30px 0;
          line-height: 1.8;
        }
        .content-section p {
          color: #D4D4D8;
          margin: 15px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background-color: #F97316;
          color: #111117;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          text-align: center;
          width: 100%;
          box-sizing: border-box;
          margin-top: 25px;
          font-size: 16px;
          transition: background-color 0.2s;
        }
        .button:hover {
          background-color: #FB923C;
        }
        .expires-note {
          background-color: #1F1F26;
          border-left: 3px solid #F97316;
          padding: 12px 16px;
          margin-top: 25px;
          border-radius: 4px;
          font-size: 13px;
          color: #A1A1A1;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          color: #71717A;
          font-size: 12px;
          border-top: 1px solid #2A2A36;
          padding-top: 20px;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo-section">
            <div class="logo-square">S</div>
            <h1>Welcome to Synapse Pharmacy</h1>
          </div>

          <div class="content-section">
            <p>Hello ${adminName},</p>
            <p>We're excited to have <strong>${pharmacyName}</strong> join the Synapse Pharmacy platform. You've been set up as the pharmacy administrator.</p>
            <p>To get started, please set up your account by clicking the button below:</p>
          </div>

          <a href="${inviteUrl}" class="button">Set Up Your Account →</a>

          <div class="expires-note">
            <strong>Note:</strong> This invite link expires in 7 days. If it expires, please contact your Synapse administrator.
          </div>

          <div class="footer">
            <p>Synapse Health Technologies Limited</p>
            <p>Kampala, Uganda</p>
            <p>© ${new Date().getFullYear()} Synapse Health. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

function generateStaffWelcomeEmailHtml({
  staffName,
  pharmacyName,
  role,
  tempPassword,
}: {
  staffName: string
  pharmacyName: string
  role: string
  tempPassword: string
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #E4E4E7;
          margin: 0;
          padding: 0;
          background-color: #07070A;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .card {
          background-color: #111117;
          border: 1px solid #2A2A36;
          border-radius: 8px;
          padding: 40px;
          margin: 20px 0;
        }
        .logo-section {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo-square{
          width: 60px;
          height: 60px;
          background-color: #F97316;
          border-radius: 8px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 24px;
          color: #111117;
        }
        h1 {
          color: #F97316;
          text-align: center;
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .subtitle {
          text-align: center;
          color: #A1A1A1;
          font-size: 14px;
          margin-bottom: 30px;
        }
        .content-section {
          margin: 30px 0;
          line-height: 1.8;
        }
        .content-section p {
          color: #D4D4D8;
          margin: 15px 0;
        }
        .credentials-box {
          background-color: #1F1F26;
          border-left: 3px solid #F97316;
          padding: 20px;
          margin: 25px 0;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
        }
        .credentials-box h3 {
          color: #F97316;
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .credential-item {
          margin: 10px 0;
          font-size: 13px;
        }
        .credential-label {
          color: #A1A1A1;
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .credential-value {
          color: #E4E4E7;
          word-break: break-all;
        }
        .warning-box {
          background-color: #7F1D1D;
          border-left: 3px solid #EF4444;
          padding: 15px;
          margin: 25px 0;
          border-radius: 4px;
        }
        .warning-box strong {
          color: #FCA5A5;
        }
        .warning-box p {
          color: #FECACA;
          margin: 5px 0;
          font-size: 13px;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background-color: #F97316;
          color: #111117;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          text-align: center;
          width: 100%;
          box-sizing: border-box;
          margin-top: 25px;
          font-size: 16px;
        }
        .button:hover {
          background-color: #FB923C;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          color: #71717A;
          font-size: 12px;
          border-top: 1px solid #2A2A36;
          padding-top: 20px;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo-section">
            <div class="logo-square">S</div>
            <h1>Welcome to Synapse Pharmacy</h1>
          </div>

          <div class="content-section">
            <p>Hello ${staffName},</p>
            <p>You've been added to <strong>${pharmacyName}</strong> as a <strong>${role}</strong>. Your account is now active and ready to use.</p>
            <p>Below are your login credentials:</p>
          </div>

          <div class="credentials-box">
            <h3>Your Login Credentials</h3>
            <div class="credential-item">
              <span class="credential-label">Email</span>
              <span class="credential-value">${staffName}</span>
            </div>
            <div class="credential-item">
              <span class="credential-label">Temporary Password</span>
              <span class="credential-value">${tempPassword}</span>
            </div>
            <div class="credential-item">
              <span class="credential-label">Role</span>
              <span class="credential-value">${role}</span>
            </div>
          </div>

          <div class="warning-box">
            <p><strong>Important Security Notice:</strong></p>
            <p>You must change your temporary password immediately upon first login. Use a strong, unique password that you haven't used elsewhere.</p>
          </div>

          <a href="https://pharm.synapseos.tech/login" class="button">Log In to Synapse Pharmacy</a>

          <div class="footer">
            <p>Synapse Health Technologies Limited</p>
            <p>Kampala, Uganda</p>
            <p>© ${new Date().getFullYear()} Synapse Health. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

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
}) {
  const html = generatePharmacyInviteEmailHtml({
    pharmacyName,
    adminName,
    inviteToken,
  })

  return sendEmail({
    to,
    subject: `You've been enrolled on Synapse Pharmacy — ${pharmacyName}`,
    html,
  })
}

export async function sendStaffWelcomeEmail({
  to,
  staffName,
  pharmacyName,
  role,
  tempPassword,
}: {
  to: string
  staffName: string
  pharmacyName: string
  role: string
  tempPassword: string
}) {
  const html = generateStaffWelcomeEmailHtml({
    staffName,
    pharmacyName,
    role,
    tempPassword,
  })

  return sendEmail({
    to,
    subject: `Welcome to Synapse Pharmacy — ${pharmacyName}`,
    html,
  })
}
