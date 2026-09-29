import { AppSidebar } from '@/components/AppSidebar'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return <AppSidebar role={user?.role}>{children}</AppSidebar>
}
