/** Canonical in-app demo routes. Next.js pages live under /demo/*. */
export const DEMO_ROUTES = {
  home: "/demo",
  login: "/demo/login",
  workspace: "/demo/workspace",
  reception: "/demo/reception",
  nurse: "/demo/nurse",
  doctor: "/demo/doctor",
  lab: "/demo/lab",
  pharmacist: "/demo/pharmacist",
  billing: "/demo/billing",
  admin: "/demo/admin",
  patient: "/demo/patient",
  timeline: "/demo/timeline",
  network: "/demo/network",
  guide: "/demo/guide",
  feedback: "/demo/feedback",
} as const

export type DemoRoute = (typeof DEMO_ROUTES)[keyof typeof DEMO_ROUTES]
