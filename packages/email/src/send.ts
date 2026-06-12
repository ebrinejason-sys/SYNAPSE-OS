// packages/email/src/send.ts
import { getResend, FROM_ADDRESS } from './client'
import { otpHtml, inviteHtml, passwordResetHtml, welcomeHtml } from './templates'

export async function sendOTP(params: {
  to: string
  name: string
  otp: string
  purpose: 'login' | 'verify' | 'reset'
}): Promise<void> {
  const subjects = {
    login: 'Your Synapse sign-in code',
    verify: 'Verify your Synapse account',
    reset: 'Reset your Synapse password',
  }
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: subjects[params.purpose],
    html: otpHtml(params),
  })
}

export async function sendInvite(params: {
  to: string
  name: string
  facilityName: string
  role: string
  inviteUrl: string
  tempPassword?: string
}): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `You've been enrolled on Synapse — ${params.facilityName}`,
    html: inviteHtml(params),
  })
}

export async function sendPasswordReset(params: {
  to: string
  name: string
  resetUrl: string
}): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: 'Reset your Synapse password',
    html: passwordResetHtml(params),
  })
}

export async function sendWelcome(params: {
  to: string
  name: string
}): Promise<void> {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Welcome to Synapse OS, ${params.name.split(' ')[0]}`,
    html: welcomeHtml(params),
  })
}
