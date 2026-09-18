export function isAuthenticatedOsLocation(href: string, slug: string): boolean {
  const url = new URL(href, "http://127.0.0.1")
  if (url.pathname.includes("/login")) return false
  if (url.searchParams.has("next")) return false
  return url.pathname === `/os/${slug}` || url.pathname.startsWith(`/os/${slug}/`)
}
