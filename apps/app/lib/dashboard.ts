import { apiRequest } from './api'
import type { DashboardKind } from './roles'

export type StatTone = 'primary' | 'gold' | 'green' | 'red' | 'muted'

export interface DashboardStat {
  key: string
  label: string
  value: string
  tone: StatTone
}

export interface DashboardListItem {
  id: string
  title: string
  subtitle?: string
  meta?: string
  tone?: StatTone
}

export interface DashboardQuickAction {
  key: string
  label: string
  /** "app:/(main)/patients" for in-app routes, or "web:/path" to open the web portal. */
  target: string
}

export interface DashboardResponse {
  role: string
  dashboardKind: DashboardKind
  tenantName: string
  tenantSlug: string
  facilityType: string
  summary: {
    stats: DashboardStat[]
    list: { title: string; items: DashboardListItem[] } | null
  }
  quickActions: DashboardQuickAction[]
}

export function fetchDashboard(token: string | null): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>('/api/mobile/dashboard', { token })
}

export const TONE_COLORS: Record<StatTone, string> = {
  primary: '#F97316',
  gold: '#E8B84B',
  green: '#22C55E',
  red: '#EF4444',
  muted: '#A1A1AA',
}
