import { supabaseAdmin } from "@/lib/supabase/admin"

type CreditEntryParams = {
  tenantId: string
  customerId: string
  amount: number
  type: "credit" | "repayment"
  transactionId?: string | null
  dueDate?: string | null
  notes?: string | null
  createdBy: string
}

export async function findOrCreateCreditCustomer(
  tenantId: string,
  params: { name: string; phone?: string | null; address?: string | null; email?: string | null }
): Promise<string> {
  const phone = params.phone?.trim() || null
  const name = params.name.trim()
  if (!name) throw new Error("Customer name is required for credit sales")

  if (phone) {
    const { data: byPhone } = await supabaseAdmin
      .from("pharmacy_customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("phone", phone)
      .maybeSingle()
    if (byPhone?.id) return byPhone.id as string
  }

  const email =
    params.email?.trim() ||
    (phone ? `credit+${phone.replace(/\D/g, "")}@synapse.local` : `credit+${Date.now()}@synapse.local`)

  const { data: created, error } = await supabaseAdmin
    .from("pharmacy_customers")
    .insert({
      tenant_id: tenantId,
      name,
      email,
      phone,
      address: params.address?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single()

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create credit customer")
  }

  return created.id as string
}

export async function postCreditLedgerEntry(params: CreditEntryParams) {
  const { data: latest } = await supabaseAdmin
    .from("pharmacy_credit_ledger")
    .select("balance_after")
    .eq("tenant_id", params.tenantId)
    .eq("customer_id", params.customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentBalance = Number(latest?.balance_after ?? 0)
  const balanceAfter =
    params.type === "credit"
      ? currentBalance + params.amount
      : Math.max(currentBalance - params.amount, 0)

  const { data, error } = await supabaseAdmin
    .from("pharmacy_credit_ledger")
    .insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      transaction_id: params.transactionId ?? null,
      amount: params.amount,
      type: params.type,
      balance_after: balanceAfter,
      due_date: params.dueDate ?? null,
      notes: params.notes ?? null,
      created_by: params.createdBy,
    })
    .select("id, balance_after")
    .single()

  if (error) throw error
  return data
}
