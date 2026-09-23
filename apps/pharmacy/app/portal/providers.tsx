"use client"

import { PharmacySessionProvider } from "@/hooks/use-pharmacy-session"

export default function PortalProviders({ children }: { children: React.ReactNode }) {
  return <PharmacySessionProvider>{children}</PharmacySessionProvider>
}
