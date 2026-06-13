import { AppSidebar } from '@/components/AppSidebar'

export default function OsLayout({ children }: { children: React.ReactNode }) {
  return <AppSidebar>{children}</AppSidebar>
}
