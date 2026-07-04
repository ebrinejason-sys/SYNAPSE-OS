/**
 * Role-aware tab navigation — blueprint §10.4 patient mobile + staff workspaces.
 * Max 5 tabs per role; hidden routes use href: null in the tab layout.
 */
import type { DashboardKind } from './roles'
import { dashboardKindForRole } from './roles'

export type MainTab =
  | 'home'
  | 'records'
  | 'appointments'
  | 'meds'
  | 'queue'
  | 'patients'
  | 'stock'
  | 'lab'
  | 'claims'
  | 'profile'

export interface TabDef {
  name: MainTab
  title: string
  icon: string
  iconFocused: string
  headerTitle?: string
}

const ALL_TABS: MainTab[] = [
  'home',
  'records',
  'appointments',
  'meds',
  'queue',
  'patients',
  'stock',
  'lab',
  'claims',
  'profile',
]

const TAB_DEFS: Record<MainTab, Omit<TabDef, 'name'>> = {
  home: { title: 'Home', icon: 'home-outline', iconFocused: 'home', headerTitle: undefined },
  records: { title: 'Records', icon: 'document-text-outline', iconFocused: 'document-text', headerTitle: 'Health Records' },
  appointments: { title: 'Visits', icon: 'calendar-outline', iconFocused: 'calendar', headerTitle: 'Appointments' },
  meds: { title: 'Meds', icon: 'medkit-outline', iconFocused: 'medkit', headerTitle: 'Medications' },
  queue: { title: 'Queue', icon: 'list-outline', iconFocused: 'list', headerTitle: "Today's Queue" },
  patients: { title: 'Patients', icon: 'people-outline', iconFocused: 'people', headerTitle: 'Patients' },
  stock: { title: 'Stock', icon: 'cube-outline', iconFocused: 'cube', headerTitle: 'Inventory' },
  lab: { title: 'Lab', icon: 'flask-outline', iconFocused: 'flask', headerTitle: 'Lab Orders' },
  claims: { title: 'Claims', icon: 'receipt-outline', iconFocused: 'receipt', headerTitle: 'Billing Claims' },
  profile: { title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle', headerTitle: 'Profile' },
}

/** Tabs visible for each dashboard kind — blueprint journeys. */
const TABS_BY_KIND: Record<DashboardKind, MainTab[]> = {
  patient: ['home', 'records', 'appointments', 'meds', 'profile'],
  clinician: ['home', 'queue', 'patients', 'profile'],
  nurse: ['home', 'queue', 'patients', 'profile'],
  reception: ['home', 'queue', 'patients', 'profile'],
  pharmacy: ['home', 'stock', 'profile'],
  lab: ['home', 'lab', 'patients', 'profile'],
  billing: ['home', 'claims', 'profile'],
  admin: ['home', 'queue', 'patients', 'profile'],
  generic: ['home', 'profile'],
}

export function getTabsForRole(role: string | null | undefined): TabDef[] {
  const kind = dashboardKindForRole(role)
  const visible = TABS_BY_KIND[kind] ?? TABS_BY_KIND.generic
  return visible.map((name) => ({ name, ...TAB_DEFS[name] }))
}

export function isTabVisible(role: string | null | undefined, tab: MainTab): boolean {
  const kind = dashboardKindForRole(role)
  const visible = TABS_BY_KIND[kind] ?? TABS_BY_KIND.generic
  return visible.includes(tab)
}

export function allMainTabs(): MainTab[] {
  return ALL_TABS
}
