import { NextResponse } from 'next/server'
import { getPharmacySession } from '@/lib/auth'

export async function GET() {
  const session = await getPharmacySession()
  return NextResponse.json(session)
}
