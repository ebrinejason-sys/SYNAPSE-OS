"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const dynamic = "force-dynamic"

type IntegrityPayload = {
  ok: boolean
  checked: number
  issueCount: number
  issues: Array<{
    productId: string
    storeId: string | null
    batchTotal: number
    sellableTotal: number
    quarantined: number
    expired: number
    damaged: number
    issues: string[]
  }>
  note?: string
}

export default function InventoryIntegrityPage() {
  const [payload, setPayload] = useState<IntegrityPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/inventory/integrity")
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? "Integrity check failed")
        setPayload(data)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Inventory integrity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Read-only reconciliation. This page never auto-fixes stock.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {payload
              ? `${payload.issueCount} issue${payload.issueCount === 1 ? "" : "s"} in ${payload.checked} product/store groups`
              : error ?? "Checking batches…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payload?.note ? <p className="text-sm text-muted-foreground mb-4">{payload.note}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Batch total</TableHead>
                <TableHead>Sellable</TableHead>
                <TableHead>Quarantined</TableHead>
                <TableHead>Expired</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payload?.issues ?? []).map((row) => (
                <TableRow key={`${row.productId}:${row.storeId ?? "main"}`}>
                  <TableCell className="font-mono text-xs">{row.productId}</TableCell>
                  <TableCell>{row.storeId ?? "main"}</TableCell>
                  <TableCell>{row.batchTotal}</TableCell>
                  <TableCell>{row.sellableTotal}</TableCell>
                  <TableCell>{row.quarantined}</TableCell>
                  <TableCell>{row.expired}</TableCell>
                  <TableCell>{row.issues.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
