/** Canonical in-app demo routes. Next.js pages live under /demo/*. */

const DEMO_LEAVES = {
  home: "/",
  login: "/login",
  workspace: "/workspace",
  reception: "/reception",
  nurse: "/nurse",
  doctor: "/doctor",
  lab: "/lab",
  pharmacist: "/pharmacist",
  billing: "/billing",
  admin: "/admin",
  patient: "/patient",
  timeline: "/timeline",
  network: "/network",
  guide: "/guide",
  feedback: "/feedback",
  intelligence: "/intelligence",
  death: "/death",
} as const

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
  intelligence: "/demo/intelligence",
  death: "/demo/death",
} as const

export type DemoRoute = (typeof DEMO_ROUTES)[keyof typeof DEMO_ROUTES]
export type DemoLeaf = (typeof DEMO_LEAVES)[keyof typeof DEMO_LEAVES]

export function isDemoDedicatedHost(hostname = ""): boolean {
  const host = (hostname.split(":")[0] ?? "").toLowerCase()
  return host === "demo.synapseos.tech" || host.endsWith(".demo.synapseos.tech")
}

/** Runtime href for the current host. On demo.synapseos.tech, /demo/login 404s; use /login. */
export function demoHref(leaf: keyof typeof DEMO_LEAVES | DemoLeaf, hostname?: string): string {
  const path = (typeof leaf === "string" && leaf.startsWith("/")
    ? leaf
    : DEMO_LEAVES[leaf as keyof typeof DEMO_LEAVES]) as DemoLeaf
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  if (isDemoDedicatedHost(host)) return path
  return path === "/" ? "/demo" : `/demo${path}`
}
