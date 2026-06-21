import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(request: NextRequest) {
  const session = await getPharmacySession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("avatar") as File | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be under 2 MB" }, { status: 400 })
  }

  const ext = file.type.split("/")[1] ?? "jpg"
  const path = `avatars/${session.userId}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await (supabaseAdmin.storage as any)
    .from("user-avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = (supabaseAdmin.storage as any)
    .from("user-avatars")
    .getPublicUrl(path)

  const avatarUrl = urlData?.publicUrl as string | undefined
  if (!avatarUrl) return NextResponse.json({ error: "Could not get public URL" }, { status: 500 })

  const { error: updateError } = await (supabaseAdmin as any)
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", session.userId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, avatarUrl })
}
