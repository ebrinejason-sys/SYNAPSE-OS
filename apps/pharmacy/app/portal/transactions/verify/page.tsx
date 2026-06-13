"use client"

import { useEffect, useState } from "react"
import { usePharmacySession } from "@/hooks/use-pharmacy-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
} from "lucide-react"

interface VerificationReport {
  timestamp: string
  totalTransactions: number
  totalTransactionItems: number
  issues: {
    orphanedTransactionItems: any[]
    missingProductReferences: any[]
    missingUserReferences: any[]
    invalidStockAdjustments: any[]
    missingBatchReferences: any[]
    inconsistentProfitData: any[]
    negativeNetAmounts: any[]
    missingCostPrices: any[]
  }
  summary: {
    totalIssuesFound: number
    dataIntegrityScore: number
    recommendedActions: string[]
  }
}

export default function TransactionVerificationPage() {
  const { user } = usePharmacySession()
  const [report, setReport] = useState<VerificationReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchVerificationReport()
  }, [])

  const fetchVerificationReport = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/transactions/verify")
      const data = await response.json()
      setReport(data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch verification report",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    setCleanupLoading(true)
    try {
      const response = await fetch("/api/admin/transactions/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup-orphaned-items" }),
      })
      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: data.message,
        })
        // Refresh the report
        fetchVerificationReport()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error,
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to run cleanup",
      })
    } finally {
      setCleanupLoading(false)
    }
  }

  const downloadReport = () => {
    if (!report) return
    const json = JSON.stringify(report, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transaction-verification-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verifying transaction data...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Failed to load verification report
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 95) return "text-[#22C55E]"
    if (score >= 80) return "text-yellow-400"
    if (score >= 50) return "text-primary"
    return "text-destructive"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 95) return "bg-green-50"
    if (score >= 80) return "bg-yellow-50"
    if (score >= 50) return "bg-orange-50"
    return "bg-red-50"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Transaction Data Verification
          </h1>
          <p className="text-muted-foreground mt-1">
            Verify data integrity and check for potential issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchVerificationReport}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={downloadReport}>
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Transactions</div>
            <div className="text-2xl font-bold mt-2">
              {report.totalTransactions}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Items</div>
            <div className="text-2xl font-bold mt-2">
              {report.totalTransactionItems}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Issues Found</div>
            <div
              className={`text-2xl font-bold mt-2 ${
                report.summary.totalIssuesFound === 0
                  ? "text-[#22C55E]"
                  : "text-destructive"
              }`}
            >
              {report.summary.totalIssuesFound}
            </div>
          </CardContent>
        </Card>

        <Card className={getScoreBgColor(report.summary.dataIntegrityScore)}>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Data Integrity Score</div>
            <div
              className={`text-2xl font-bold mt-2 ${getScoreColor(
                report.summary.dataIntegrityScore
              )}`}
            >
              {report.summary.dataIntegrityScore.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Banner */}
      {report.summary.totalIssuesFound === 0 ? (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-[#22C55E] flex-shrink-0" />
            <div>
              <div className="font-semibold text-green-900">All Systems OK</div>
              <p className="text-sm text-[#22C55E]">
                No data integrity issues found. All transactions are properly
                recorded.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-red-900">
                {report.summary.totalIssuesFound} Issue(s) Found
              </div>
              <p className="text-sm text-destructive mt-1">
                Data integrity problems detected. Review and resolve issues
                below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issues Details */}
      {report.issues.orphanedTransactionItems.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="h-5 w-5" />
              Orphaned Transaction Items ({report.issues.orphanedTransactionItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive mb-4">
              Transaction items exist without parent transactions. This can cause
              data inconsistencies.
            </p>
            <Button onClick={handleCleanup} disabled={cleanupLoading}>
              {cleanupLoading ? "Cleaning..." : "Clean Up Orphaned Items"}
            </Button>
          </CardContent>
        </Card>
      )}

      {report.issues.missingProductReferences.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Missing Product References (
              {report.issues.missingProductReferences.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-destructive">
              Transaction items reference products that no longer exist. These
              items cannot be fully analyzed.
            </p>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {report.issues.missingProductReferences.slice(0, 5).map((issue) => (
                <div
                  key={issue.itemId}
                  className="text-sm bg-card p-2 rounded border border-red-100"
                >
                  <div className="font-mono text-xs">{issue.productId}</div>
                  <div className="text-xs text-muted-foreground">
                    Transaction: {issue.transactionId}
                  </div>
                </div>
              ))}
            </div>
            {report.issues.missingProductReferences.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{report.issues.missingProductReferences.length - 5} more items
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {report.issues.missingCostPrices.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-900">
              <AlertTriangle className="h-5 w-5" />
              Missing Cost Prices ({report.issues.missingCostPrices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-400">
              {report.issues.missingCostPrices.length} transaction items do not
              have recorded cost prices. Profit calculations may be inaccurate
              for these items. This is typically from older transactions before
              the cost price tracking feature was implemented.
            </p>
          </CardContent>
        </Card>
      )}

      {report.issues.negativeNetAmounts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Negative Net Amounts ({report.issues.negativeNetAmounts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive mb-4">
              Transactions with negative net amounts indicate calculation errors.
              These should be reviewed and corrected.
            </p>
          </CardContent>
        </Card>
      )}

      {report.issues.missingUserReferences.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertTriangle className="h-5 w-5" />
              Missing Staff References ({report.issues.missingUserReferences.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700">
              {report.issues.missingUserReferences.length} transactions reference
              staff members that have been deleted. These staff records should be
              restored or transactions reassigned.
            </p>
          </CardContent>
        </Card>
      )}

      {report.issues.invalidStockAdjustments.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Invalid Stock Adjustments (
              {report.issues.invalidStockAdjustments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              Stock adjustments reference transactions that no longer exist.
              Stock levels may be incorrect.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {report.summary.recommendedActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.summary.recommendedActions.map((action, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-sm text-foreground"
                >
                  <div className="mt-1">
                    {action.includes("✓") ? (
                      <CheckCircle className="h-4 w-4 text-[#22C55E]" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Report Details */}
      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Report Generated:</span>
            <span className="font-mono">
              {new Date(report.timestamp).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Transactions:</span>
            <span className="font-mono">{report.totalTransactions}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Transaction Items:</span>
            <span className="font-mono">{report.totalTransactionItems}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
