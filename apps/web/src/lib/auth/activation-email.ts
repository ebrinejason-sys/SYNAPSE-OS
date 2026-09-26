import { signShortToken } from '@synapse/auth'
import { sendActivationEmail } from '../resend'

export type ActivationEmailResult = {
  sent: boolean
  error?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function trySendActivationEmail({
  origin,
  userId,
  email,
  name,
  logContext,
}: {
  origin: string
  userId: string
  email: string
  name: string
  logContext: string
}): Promise<ActivationEmailResult> {
  const token = await signShortToken({ sub: userId, purpose: 'verify' }, '24h')
  const activationUrl = `${origin}/api/auth/activate?token=${encodeURIComponent(token)}`

  try {
    await sendActivationEmail(email, name, activationUrl)
    return { sent: true }
  } catch (error) {
    const message = errorMessage(error)
    console.error(`[${logContext}] activation email failed error="${message}"`)
    return { sent: false, error: message }
  }
}
