"use client"

import { usePharmacySession } from "@/hooks/use-pharmacy-session"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Package, ShoppingCart, Eye } from "lucide-react"

export default function StaffDashboard() {
  const { user } = usePharmacySession()
  const router = useRouter()

  const hasPermission = (permission: string) => {
    return (user?.permissions ?? []).includes(permission)
  }

  const features = [
    {
      title: "Inventory",
      description: "View and manage product inventory",
      icon: Package,
      permission: "VIEW_INVENTORY",
      action: () => router.push("/portal/inventory"),
    },
    {
      title: "POS",
      description: "Process sales and transactions",
      icon: ShoppingCart,
      permission: "MANAGE_POS",
      action: () => router.push("/portal/pos"),
    },
    {
      title: "Transactions",
      description: "View transaction history",
      icon: Eye,
      permission: "VIEW_TRANSACTIONS",
      action: () => router.push("/portal/transactions"),
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.fullName ?? ""}</h1>
        <p className="text-gray-500 mt-2">What would you like to do today?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon
          const allowed = hasPermission(feature.permission)
          
          return (
            <Card key={feature.title} className={!allowed ? "opacity-50" : ""}>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Icon className="h-6 w-6 text-primary" />
                  <CardTitle>{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">{feature.description}</p>
                <Button
                  onClick={feature.action}
                  disabled={!allowed}
                  className="w-full"
                >
                  {allowed ? "Access" : "No Permission"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
