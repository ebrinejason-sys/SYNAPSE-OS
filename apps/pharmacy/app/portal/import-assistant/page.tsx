"use client"

import { useEffect, useState } from "react"
import { BrainCircuit, FileSpreadsheet, Wand2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

export const dynamic = "force-dynamic"

type MappingRow = {
  source: string
  target: string
  confidence: number
  status: string
}

type ImportSession = {
  id: string
  file_name: string | null
  source_system: string | null
  status: string | null
  total_rows: number | null
  matched_rows: number | null
  flagged_rows: number | null
  ai_summary: string | null
  created_at: string | null
}

type ApplyResult = {
  success: number
  failed: number
  skipped: number
  rows: Array<{
    rowIndex: number
    status: string
    reason?: string
    productName?: string
  }>
}

export default function ImportAssistantPage() {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<ImportSession[]>([])
  const [sourceSystem, setSourceSystem] = useState("")
  const [fileName, setFileName] = useState("")
  const [headersText, setHeadersText] = useState("")
  const [sampleText, setSampleText] = useState("")
  const [mapping, setMapping] = useState<MappingRow[]>([])
  const [summary, setSummary] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null)

  async function loadSessions() {
    const response = await fetch("/api/admin/import-sessions")
    const data = await response.json()
    setSessions(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    loadSessions()
  }, [])

  async function analyse(event: React.FormEvent) {
    event.preventDefault()
    setIsLoading(true)
    setApplyResult(null)
    const headers = headersText.split(",").map((item) => item.trim()).filter(Boolean)
    const sampleRows = sampleText
      .split("\n")
      .map((line) => line.split(",").map((item) => item.trim()))
      .filter((row) => row.some(Boolean))

    const response = await fetch("/api/admin/import-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceSystem, fileName, headers, sampleRows, totalRows: sampleRows.length }),
    })
    const data = await response.json()
    setIsLoading(false)
    if (!response.ok) {
      toast({ variant: "destructive", title: data.error ?? "Import analysis failed" })
      return
    }
    setMapping(data.mapping ?? [])
    setSummary(data.summary ?? "")
    setCurrentSessionId(data.session?.id ?? null)
    toast({ title: "Import mapping ready for review" })
    loadSessions()
  }

  async function applyImport() {
    if (!currentSessionId) {
      toast({ variant: "destructive", title: "No session to apply" })
      return
    }

    const allRows = sampleText
      .split("\n")
      .map((line) => line.split(",").map((item) => item.trim()))
      .filter((row) => row.some(Boolean))

    if (allRows.length === 0) {
      toast({ variant: "destructive", title: "No rows to import" })
      return
    }

    setIsApplying(true)
    setApplyResult(null)

    const response = await fetch(`/api/admin/import-sessions/${currentSessionId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allRows }),
    })

    const data = await response.json()
    setIsApplying(false)

    if (!response.ok) {
      toast({ variant: "destructive", title: data.error ?? "Import failed" })
      return
    }

    setApplyResult(data.result)
    toast({
      title: "Import complete",
      description: data.message,
    })
    loadSessions()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Auto-Migration Assistant</h1>
        <p className="text-muted-foreground mt-1 text-sm">Map messy pharmacy exports into Synapse inventory fields before bulk import.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /> Analyse file structure</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={analyse} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Source system</Label>
                <Input value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} placeholder="Excel, QuickBooks, supplier CSV..." />
              </div>
              <div className="space-y-1.5">
                <Label>File name</Label>
                <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="stock-export-june.csv" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>CSV headers</Label>
              <Input value={headersText} onChange={(e) => setHeadersText(e.target.value)} placeholder="Item, Qty, Selling Price, Expiry, Batch" required />
            </div>
            <div className="space-y-1.5">
              <Label>Sample rows</Label>
              <textarea
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={"Panadol 500mg, 120, 500, 2027-02-01, B123\nAmoxicillin 250mg, 80, 1200, 2026-11-30, A77"}
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              <Wand2 className="h-4 w-4" />
              {isLoading ? "Analysing..." : "Generate mapping"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mapping.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#E8B84B]" /> Mapping preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{summary}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source column</TableHead>
                  <TableHead>Synapse field</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapping.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell>{row.source}</TableCell>
                    <TableCell className="font-mono text-xs">{row.target}</TableCell>
                    <TableCell>{Math.round(row.confidence * 100)}%</TableCell>
                    <TableCell>{row.status === "mapped" ? <span className="text-[#22C55E]">Mapped</span> : <span className="text-[#E8B84B]">Review</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <div className="flex gap-2 pt-4">
              <Button onClick={applyImport} disabled={isApplying} className="bg-[#22C55E] hover:bg-[#22C55E]/90">
                <Upload className="h-4 w-4" />
                {isApplying ? "Importing..." : "Apply Import"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {applyResult && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-2xl font-bold text-[#22C55E]">{applyResult.success}</div>
                <div className="text-sm text-muted-foreground">Success</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-2xl font-bold text-destructive">{applyResult.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-2xl font-bold text-[#E8B84B]">{applyResult.skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>

            {applyResult.failed > 0 && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Failed rows:</p>
                    <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                      {applyResult.rows
                        .filter((r) => r.status === "failed")
                        .slice(0, 10)
                        .map((r) => (
                          <div key={r.rowIndex} className="text-xs">
                            Row {r.rowIndex + 1}: {r.productName || "Unknown"} - {r.reason}
                          </div>
                        ))}
                      {applyResult.rows.filter((r) => r.status === "failed").length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {applyResult.rows.filter((r) => r.status === "failed").length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent import sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No import sessions yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Matched</TableHead>
                  <TableHead>Flagged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.file_name ?? "Manual mapping"}</TableCell>
                    <TableCell>{session.source_system ?? "Unknown"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          session.status === "complete"
                            ? "bg-[#22C55E]/10 text-[#22C55E]"
                            : session.status === "failed"
                              ? "bg-destructive/10 text-destructive"
                              : session.status === "importing"
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-[#E8B84B]/10 text-[#E8B84B]"
                        }`}
                      >
                        {session.status}
                      </span>
                    </TableCell>
                    <TableCell>{session.matched_rows ?? 0}</TableCell>
                    <TableCell>{session.flagged_rows ?? 0}</TableCell>
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
