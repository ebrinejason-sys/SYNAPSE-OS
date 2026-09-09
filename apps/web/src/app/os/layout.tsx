import { AppSidebar } from '@/components/AppSidebar'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export default async function OsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug?: string }>
}) {
  const user = await getCurrentUser()
  const { slug } = await params
  return <AppSidebar role={user?.role} tenantSlug={slug}>{children}</AppSidebar>
}
