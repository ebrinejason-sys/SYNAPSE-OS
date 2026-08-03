import { NextResponse } from 'next/server'
import { androidApkUrl } from '@/lib/mobile-download'

export const dynamic = 'force-dynamic'

/** Stable public redirect so landings can use /download/android. */
export function GET() {
  return NextResponse.redirect(androidApkUrl(), 302)
}
