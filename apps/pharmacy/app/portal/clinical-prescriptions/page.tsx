"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type Rx = {
  id: string
  medication_display: string
  dose: string | null
  quantity: number
  unit: string
  status: string
  is_synthetic: boolean
  created_at: string
}

export default function ClinicalPrescriptionsPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<Rx[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    const res = await fetch("/api/admin/clinical-prescriptions")
    const data = await res.json()
    setRows(data.prescriptions ?? [])
    setNotice(data.notice ?? null)
  }

  useEffect(() => {
    load().catch(() => setNotice("Unable to load clinical prescriptions"))
  }, [])

  async function act(id: string, action: string) {
    const res = await fetch("/api/admin/clinical-prescriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: "Unable to update prescription", description: data.error, variant: "destructive" })
      return
    }
    await load()
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Clinical prescriptions</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Incoming MedicationRequests from Synapse OS. Prescribing and dispensing remain separate permissions.
        </p>
      </div>
      {notice ? <p className="text-sm text-amber-300">{notice}</p> : null}
      <Card className="border-white/10 bg-zinc-950">
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No clinical prescriptions for this pharmacy tenant.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3">
                  <div>
                    <p className="font-medium text-white">{row.medication_display}</p>
                    <p className="text-xs text-zinc-400">
                      {row.dose} · qty {row.quantity} {row.unit} · {row.status}
                      {row.is_synthetic ? " · SYNTHETIC" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => act(row.id, "verify")}>
                      Verify
                    </Button>
                    <Button size="sm" onClick={() => act(row.id, "dispense")}>
                      Dispense
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
