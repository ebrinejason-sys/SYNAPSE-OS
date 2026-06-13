"use client"

import { useEffect, useState } from "react"
import { CalendarClock, CheckCircle2, MessageSquareText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

export const dynamic = "force-dynamic"

type Refill = {
  id: string
  drug_name: string
  refill_due_date: string
  reminder_sent: boolean | null
  dispensed: boolean | null
  customer?: { name?: string | null; phone?: string | null; email?: string | null } | null
}

export default function RefillsPage() {
  const { toast } = useToast()
  const [refills, setRefills] = useState<Refill[]>([])
  const [status, setStatus] = useState("due")
  const [isLoading, setIsLoading] = useState(true)
  const [form, setForm] = useState({ customerId: "", drugName: "", refillDueDate: "", intervalDays: "30" })

  async function loadRefills(nextStatus = status) {
    setIsLoading(true)
    const response = await fetch(`/api/admin/refills?status=${nextStatus}`)
    const data = await response.json()
    setRefills(Array.isArray(data) ? data : [])
    setIsLoading(false)
  }

  useEffect(() => {
    loadRefills()
  }, [])

  async function createReminder(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch("/api/admin/refills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!response.ok) {
      toast({ variant: "destructive", title: "Refill reminder not created" })
      return
    }
    setForm({ customerId: "", drugName: "", refillDueDate: "", intervalDays: "30" })
    toast({ title: "Refill reminder created" })
    loadRefills()
  }

  async function updateReminder(id: string, action: "mark_sent" | "mark_dispensed") {
    const response = await fetch("/api/admin/refills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    })
    if (!response.ok) {
      toast({ variant: "destructive", title: "Could not update reminder" })
      return
    }
    loadRefills()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Refill Reminders</h1>
        <p className="text-muted-foreground mt-1 text-sm">Track customers due for medication refill and follow up before adherence drops.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> New reminder</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createReminder} className="grid gap-4 md:grid-cols-5">
            <div className="space-y-1.5 md:col-span-1">
              <Label>Customer ID</Label>
              <Input value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Drug name</Label>
              <Input value={form.drugName} onChange={(e) => setForm({ ...form, drugName: e.target.value })} placeholder="Metformin 500mg" required />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={form.refillDueDate} onChange={(e) => setForm({ ...form, refillDueDate: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Interval days</Label>
              <Input type="number" value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} />
            </div>
            <Button type="submit" className="md:col-start-5">Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-[#E8B84B]" /> Follow-up queue</CardTitle>
          <div className="flex gap-2">
            {["due", "upcoming", "dispensed", "all"].map((item) => (
              <Button key={item} variant={status === item ? "default" : "outline"} size="sm" onClick={() => { setStatus(item); loadRefills(item) }}>
                {item}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-32 rounded-lg bg-muted/30" />
          ) : refills.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No refill reminders in this queue.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Drug</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refills.map((refill) => (
                  <TableRow key={refill.id}>
                    <TableCell>
                      <div className="font-medium">{refill.customer?.name ?? "Customer"}</div>
                      <div className="text-xs text-muted-foreground">{refill.customer?.phone ?? refill.customer?.email ?? "No contact"}</div>
                    </TableCell>
                    <TableCell>{refill.drug_name}</TableCell>
                    <TableCell>{new Date(refill.refill_due_date).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>{refill.dispensed ? "Dispensed" : refill.reminder_sent ? "Contacted" : "Due"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateReminder(refill.id, "mark_sent")}><MessageSquareText className="h-4 w-4" /> Contacted</Button>
                        <Button size="sm" onClick={() => updateReminder(refill.id, "mark_dispensed")}><CheckCircle2 className="h-4 w-4" /> Dispensed</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
