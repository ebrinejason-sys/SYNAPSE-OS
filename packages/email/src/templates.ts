// packages/email/src/templates.ts
import { brandedHtml } from './client'

const ORANGE = '#F97316'
const MUTED = '#A0A0B0'
const DIM = '#60607A'

export function otpHtml(params: {
  name: string
  otp: string
  purpose: 'login' | 'verify' | 'reset'
  expiryMinutes?: number
}): string {
  const verb = { login: 'sign in', verify: 'verify your email', reset: 'reset your password' }[params.purpose]
  return brandedHtml(`
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#F5F5F7;">Your verification code</h2>
    <p style="font-size:14px;line-height:1.6;color:${MUTED};margin:0 0 28px;">
      Hello ${params.name || 'there'},<br/>
      Use this code to ${verb}. It expires in
      <strong style="color:#F5F5F7;">${params.expiryMinutes ?? 10} minutes</strong>.
    </p>
    <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);
                border-radius:12px;padding:28px 20px;text-align:center;margin-bottom:28px;">
      <span style="font-family:monospace;font-size:42px;font-weight:700;
                   letter-spacing:0.25em;color:${ORANGE};">${params.otp}</span>
    </div>
    <p style="font-size:13px;color:${DIM};margin:0;">
      Never share this code. Synapse will never ask for it by phone or chat.<br/>
      If you didn't request this, you can safely ignore this email.
    </p>
  `)
}

export function inviteHtml(params: {
  name: string
  facilityName: string
  role: string
  inviteUrl: string
  tempPassword?: string
}): string {
  const passBlock = params.tempPassword ? `
    <p style="color:${MUTED};margin:0 0 8px;font-size:13px;">Your temporary password:</p>
    <p style="font-family:monospace;font-size:18px;color:#E8B84B;background:#1A1A24;
              padding:12px;border-radius:6px;margin:0 0 8px;">${params.tempPassword}</p>
    <p style="color:#EF4444;font-size:12px;margin:0 0 16px;">
      ⚠ Change this password immediately after first login.
    </p>` : ''

  return brandedHtml(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#F5F5F7;">
      You've been added to ${params.facilityName}
    </h2>
    <p style="font-size:14px;line-height:1.7;color:${MUTED};margin:0 0 8px;">
      Hello ${params.name},<br/>
      You have been enrolled as a <strong style="color:${ORANGE};">${params.role}</strong>
      at <strong style="color:#F5F5F7;">${params.facilityName}</strong> on the Synapse Health platform.
    </p>
    <div style="background:#1A1A24;border:1px solid rgba(255,255,255,0.08);border-radius:10px;
                padding:20px;margin:20px 0;">
      ${passBlock}
      <a href="${params.inviteUrl}"
         style="display:inline-block;background:${ORANGE};color:#07070A;font-weight:700;
                font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
        Set Up Your Account →
      </a>
      <p style="color:${DIM};font-size:12px;margin:12px 0 0;">This link expires in 48 hours.</p>
    </div>
  `)
}

export function passwordResetHtml(params: { name: string; resetUrl: string }): string {
  return brandedHtml(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#F5F5F7;">Reset your password</h2>
    <p style="font-size:14px;line-height:1.7;color:#A0A0B0;margin:0 0 24px;">
      Hello ${params.name || 'there'},<br/>
      We received a request to reset your Synapse password.
    </p>
    <a href="${params.resetUrl}"
       style="display:inline-block;background:${ORANGE};color:#07070A;font-weight:700;
              font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      Reset Password →
    </a>
    <p style="color:#60607A;font-size:12px;margin:16px 0 0;">
      This link expires in 15 minutes. If you didn't request this, ignore this email.
    </p>
  `)
}

export function welcomeHtml(params: {
  name: string
  product?: string
  ctaUrl?: string
  ctaLabel?: string
}): string {
  const product = params.product ?? 'Synapse OS'
  const ctaUrl = params.ctaUrl ?? 'https://synapseos.tech/health/dashboard'
  const ctaLabel = params.ctaLabel ?? 'Open Dashboard →'
  return brandedHtml(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F5F5F7;">
      Welcome, ${params.name.split(' ')[0]}. Your account is ready.
    </h2>
    <p style="font-size:15px;line-height:1.7;color:#A0A0B0;margin:0 0 20px;">
      You've successfully joined ${product} — built for Ugandan pharmacies and health facilities.
    </p>
    <a href="${ctaUrl}"
       style="display:inline-block;background:#F97316;color:#07070A;font-weight:700;
              font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;">
      ${ctaLabel}
    </a>
  `)
}
