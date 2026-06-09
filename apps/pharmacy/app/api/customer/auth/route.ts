import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Buffer.from(hash).toString("hex")
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, action, tenant_id: tenantId } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 })
    }

    if (action === "register") {
      if (!email || !password || !name) {
        return NextResponse.json({ error: "Email, password, and name are required" }, { status: 400 })
      }

      // Check if customer exists in this tenant
      const { data: existingCustomer } = await supabaseAdmin
        .from("pharmacy_customers")
        .select("id")
        .eq("email", email)
        .eq("tenant_id", tenantId)
        .maybeSingle()

      if (existingCustomer) {
        return NextResponse.json({ error: "Email already registered" }, { status: 400 })
      }

      const hashedPassword = await hashPassword(password)

      const { data: customer, error: createError } = await supabaseAdmin
        .from("pharmacy_customers")
        .insert({
          tenant_id: tenantId,
          email,
          name,
          is_active: true,
          password_hash: hashedPassword,
        })
        .select("id, name, email")
        .single()

      if (createError || !customer) {
        console.error("Customer registration error:", createError)
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else if (action === "login") {
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
      }

      // Find customer in this tenant
      const { data: customer, error: fetchError } = await supabaseAdmin
        .from("pharmacy_customers")
        .select("id, name, email, is_active, password_hash")
        .eq("email", email)
        .eq("tenant_id", tenantId)
        .single()

      if (fetchError || !customer || !customer.is_active) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      }

      if (!customer.password_hash) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      }

      const isPasswordValid = await verifyPassword(password, customer.password_hash as string)

      if (!isPasswordValid) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      }

      return NextResponse.json({
        success: true,
        customerId: customer.id,
        name: customer.name,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Customer auth error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
