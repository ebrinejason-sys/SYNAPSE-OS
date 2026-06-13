import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, hasPermission, isPharmacyAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

function canViewLedger(session: NonNullable<Awaited<ReturnType<typeof getPharmacySession>>>) {
  return (
    isPharmacyAdmin(session) ||
    hasPermission(session, "VIEW_REPORTS") ||
    hasPermission(session, "VIEW_TRANSACTIONS") ||
    hasPermission(session, "MANAGE_TRANSACTIONS")
  )
}

export async function GET() {
  try {
    const session = await getPharmacySession()
    if (!session || !canViewLedger(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("pharmacy_credit_ledger")
      .select("*, customer:pharmacy_customers(id, name, email, phone)")
      .eq("tenant_id", session.profile.tenant_id!)
      .order("created_at", { ascending: false })

    if (error) throw error

    const rows = data ?? []
    const latestByCustomer = new Map<string, { balance_after: number; due_date?: string | null }>()
    for (const row of rows) {
      const customerId = row.customer_id as string | null
      if (customerId && !latestByCustomer.has(customerId)) {
        latestByCustomer.set(customerId, {
          balance_after: Number(row.balance_after ?? 0),
          due_date: row.due_date,
        })
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const balances = Array.from(latestByCustomer.values())
    const totalOutstanding = balances.reduce((sum, row) => sum + Math.max(row.balance_after, 0), 0)
    const overdueOutstanding = balances
      .filter((row) => row.due_date && row.due_date < today && row.balance_after > 0)
      .reduce((sum, row) => sum + row.balance_after, 0)

    return NextResponse.json({
      summary: {
        totalOutstanding,
        overdueOutstanding,
        creditCustomers: balances.filter((row) => row.balance_after > 0).length,
        overdueCustomers: balances.filter((row) => row.due_date && row.due_date < today && row.balance_after > 0).length,
      },
      entries: rows,
    })
  } catch (error) {
    console.error("Credit ledger GET error:", error)
    return NextResponse.json({ error: "Failed to fetch credit ledger" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session || !canViewLedger(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const customerId = String(body.customerId ?? "").trim()
    const type = String(body.type ?? "").trim()
    const amount = Number(body.amount ?? 0)

    if (!customerId || !["credit", "repayment"].includes(type) || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Customer, entry type, and positive amount are required" }, { status: 400 })
    }

    const { data: latest } = await supabaseAdmin
      .from("pharmacy_credit_ledger")
      .select("balance_after")
      .eq("tenant_id", session.profile.tenant_id!)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentBalance = Number(latest?.balance_after ?? 0)
    const balanceAfter = type === "credit" ? currentBalance + amount : Math.max(currentBalance - amount, 0)

    const { data, error } = await supabaseAdmin
      .from("pharmacy_credit_ledger")
      .insert({
        tenant_id: session.profile.tenant_id!,
        customer_id: customerId,
        transaction_id: body.transactionId || null,
        amount,
        type,
        balance_after: balanceAfter,
        due_date: body.dueDate || null,
        notes: body.notes || null,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (error) throw error

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: session.profile.tenant_id!,
      profile_id: session.user.id,
      action: "CREATE_CREDIT_LEDGER_ENTRY",
      entity: "PHARMACY_CREDIT_LEDGER",
      entity_id: data.id,
      details: `${type} entry of ${amount} recorded. Balance: ${balanceAfter}`,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Credit ledger POST error:", error)
    return NextResponse.json({ error: "Failed to create credit ledger entry" }, { status: 500 })
  }
}
