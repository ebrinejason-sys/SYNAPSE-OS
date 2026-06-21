import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@synapse/auth/tokens"
import { SESSION_COOKIE } from "@synapse/config/constants"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=no_token", req.url))
  }

  try {
    const payload = await verifyToken(token)

    // Only allow impersonation tokens
    if (!payload.is_impersonation) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", req.url))
    }
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url))
  }

  const response = NextResponse.redirect(new URL("/portal/dashboard", req.url))
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 2 * 60 * 60, // 2 hours
  })

  return response
}
