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
  return apiRequest<unknown>('/api/mobile/dashboard', { token }).then((raw) => {
    const data = raw as Partial<DashboardResponse>
    if (!data || typeof data !== 'object' || !data.summary || !Array.isArray(data.summary.stats)) {
      throw new Error('Dashboard data was incomplete. Pull down to refresh.')
    }
    return {
      role: data.role ?? '',
      dashboardKind: data.dashboardKind ?? 'generic',
      tenantName: data.tenantName ?? '',
      tenantSlug: data.tenantSlug ?? '',
      facilityType: data.facilityType ?? '',
      summary: {
        stats: data.summary.stats,
        list: data.summary.list ?? null,
      },
      quickActions: Array.isArray(data.quickActions) ? data.quickActions : [],
    }
  })
}

export const TONE_COLORS: Record<StatTone, string> = {
  primary: '#F97316',
  gold: '#E8B84B',
  green: '#22C55E',
  red: '#EF4444',
  muted: '#A1A1AA',
}
