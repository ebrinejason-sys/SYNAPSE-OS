"use client"

import { useEffect, useState } from "react"
import { usePharmacySession } from "@/hooks/use-pharmacy-session"

export const dynamic = 'force-dynamic'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Mail,
  Search,
  KeyRound,
  Zap,
  Trash2,
  HelpCircle
} from "lucide-react"

interface Inquiry {
  id: string
  userId?: string
  userEmail: string
  userName: string
  type: string
  subject: string
  message: string
  status: string
  adminResponse?: string
  respondedAt?: string
  createdAt: string
}

export default function InquiriesPage() {
  const { user } = usePharmacySession()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [filteredInquiries, setFilteredInquiries] = useState<Inquiry[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchInquiries()
  }, [])

  useEffect(() => {
    let filtered = [...inquiries]
    
    if (searchQuery) {
      filtered = filtered.filter(
        (inq) =>
          inq.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inq.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inq.subject.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    if (statusFilter) {
      filtered = filtered.filter((inq) => inq.status === statusFilter)
    }
    
    if (typeFilter) {
      filtered = filtered.filter((inq) => inq.type === typeFilter)
    }
    
    setFilteredInquiries(filtered)
  }, [searchQuery, statusFilter, typeFilter, inquiries])

  const fetchInquiries = async () => {
    try {
      const response = await fetch("/api/admin/inquiries")
      const data = await response.json()
      if (Array.isArray(data)) {
        setInquiries(data)
        setFilteredInquiries(data)
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch inquiries",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "PASSWORD_RESET": return <KeyRound className="h-4 w-4" />
      case "FEATURE_REQUEST": return <Zap className="h-4 w-4" />
      case "DELETE_REQUEST": return <Trash2 className="h-4 w-4" />
      case "ACCESS_REQUEST": return <Mail className="h-4 w-4" />
      default: return <HelpCircle className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "PASSWORD_RESET": return "bg-primary/15 text-orange-700"
      case "FEATURE_REQUEST": return "bg-blue-500/15 text-blue-400"
      case "DELETE_REQUEST": return "bg-red-500/15 text-destructive"
      case "ACCESS_REQUEST": return "bg-purple-500/15 text-purple-400"
      default: return "bg-muted/30 text-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING": return <Clock className="h-4 w-4" />
      case "RESOLVED": return <CheckCircle className="h-4 w-4" />
      case "REJECTED": return <XCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-500/15 text-yellow-400"
      case "RESOLVED": return "bg-green-500/15 text-[#22C55E]"
      case "REJECTED": return "bg-red-500/15 text-destructive"
      default: return "bg-muted/30 text-foreground"
    }
  }

  const pendingCount = inquiries.filter(i => i.status === "PENDING").length
  const resolvedCount = inquiries.filter(i => i.status === "RESOLVED").length
  const rejectedCount = inquiries.filter(i => i.status === "REJECTED").length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">User Inquiries</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Manage user requests, password resets, and feature requests</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inquiries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-[#22C55E]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#22C55E]">{resolvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{rejectedCount}</div>
          </CardContent>
        </Card>
      </div>

      {selectedInquiry && (
        <InquiryDetailDialog
          inquiry={selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
          onSuccess={() => {
            setSelectedInquiry(null)
            fetchInquiries()
          }}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Inquiries ({filteredInquiries.length})</CardTitle>
            <div className="flex flex-wrap gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                title="Filter by Type"
              >
                <option value="">All Types</option>
                <option value="PASSWORD_RESET">Password Reset</option>
                <option value="FEATURE_REQUEST">Feature Request</option>
                <option value="DELETE_REQUEST">Delete Request</option>
                <option value="ACCESS_REQUEST">Access Request</option>
                <option value="OTHER">Other</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                title="Filter by Status"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="RESOLVED">Resolved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInquiries.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{inquiry.userName}</div>
                      <div className="text-xs text-muted-foreground">{inquiry.userEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${getTypeColor(inquiry.type)}`}>
                      {getTypeIcon(inquiry.type)}
                      {inquiry.type.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{inquiry.subject}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${getStatusColor(inquiry.status)}`}>
                      {getStatusIcon(inquiry.status)}
                      {inquiry.status}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(inquiry.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedInquiry(inquiry)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

interface InquiryDetailDialogProps {
  inquiry: Inquiry
  onClose: () => void
  onSuccess: () => void
}

function InquiryDetailDialog({ inquiry, onClose, onSuccess }: InquiryDetailDialogProps) {
  const [response, setResponse] = useState(inquiry.adminResponse || "")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleStatusUpdate = async (status: string) => {
    if (status === "RESOLVED" && !response) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a response before resolving",
      })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: inquiry.id,
          status,
          adminResponse: response,
        }),
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: `Inquiry marked as ${status.toLowerCase()}`,
        })
        onSuccess()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update inquiry",
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inquiry Details</span>
            <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">From</label>
              <p className="font-medium">{inquiry.userName}</p>
              <p className="text-sm text-muted-foreground">{inquiry.userEmail}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Type</label>
              <p className="font-medium">{inquiry.type.replace(/_/g, " ")}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Status</label>
              <p className="font-medium">{inquiry.status}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Date</label>
              <p className="font-medium">{new Date(inquiry.createdAt).toLocaleString()}</p>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Subject</label>
            <p className="font-medium">{inquiry.subject}</p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Message</label>
            <div className="bg-muted/20 rounded-lg p-4 mt-1">
              <p className="whitespace-pre-wrap">{inquiry.message}</p>
            </div>
          </div>

          {inquiry.status === "PENDING" && (
            <>
              <div>
                <label className="text-sm text-muted-foreground">Your Response</label>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                  placeholder="Enter your response to the user..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleStatusUpdate("REJECTED")}
                  disabled={isLoading}
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleStatusUpdate("RESOLVED")}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve & Send Response
                </Button>
              </div>
            </>
          )}

          {inquiry.status !== "PENDING" && inquiry.adminResponse && (
            <div>
              <label className="text-sm text-muted-foreground">Admin Response</label>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-1">
                <p className="whitespace-pre-wrap">{inquiry.adminResponse}</p>
                {inquiry.respondedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Responded on {new Date(inquiry.respondedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {inquiry.status !== "PENDING" && (
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
