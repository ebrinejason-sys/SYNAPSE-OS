"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export const dynamic = "force-dynamic"

type Branch = {
  id: string
  name: string
  storeType: string
  isActive: boolean
  isWarehouse: boolean
  address: string | null
  district: string | null
  phone: string | null
}

export default function BranchesPage() {
  const { toast } = useToast()
  const [branches, setBranches] = useState<Branch[]>([])
  const [name, setName] = useState("")
  const [storeType, setStoreType] = useState("satellite")
  const [district, setDistrict] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await fetch("/api/admin/branches")
    const data = await res.json()
    setBranches(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const createBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, storeType, district, phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not create branch", description: data.error })
        return
      }
      toast({ title: "Branch created", description: `${data.name} is ready for staff, stock and POS.` })
      setName("")
      setDistrict("")
      setPhone("")
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-2">Branches and satellites</h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          Each site keeps its own stock, POS and staff. Head office can still read consolidated reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a branch</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createBranch} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-type">Site type</Label>
              <select
                id="branch-type"
                value={storeType}
                onChange={(e) => setStoreType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="satellite">Satellite / branch</option>
                <option value="main">Main</option>
                <option value="warehouse">Warehouse</option>
                <option value="dispensary">Dispensary</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-district">District</Label>
              <Input id="branch-district" value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-phone">Phone</Label>
              <Input id="branch-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Creating…" : "Create branch"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sites in this organization</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading branches…</p>
          ) : branches.length === 0 ? (
            <p className="text-muted-foreground">No branches yet. Create the first site above.</p>
          ) : (
            <ul className="divide-y">
              {branches.map((branch) => (
                <li key={branch.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {branch.storeType}
                      {branch.isWarehouse ? " · warehouse" : ""}
                      {branch.district ? ` · ${branch.district}` : ""}
                      {branch.phone ? ` · ${branch.phone}` : ""}
                    </p>
                  </div>
                  <span className="text-sm">{branch.isActive ? "Active" : "Inactive"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
