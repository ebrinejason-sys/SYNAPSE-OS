import { Resend } from 'resend'

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

