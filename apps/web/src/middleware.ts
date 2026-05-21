import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";

  // Determine if this is a tenant subdomain request
  const isPlatformAdmin = hostname.startsWith("admin.");
  const isApp = hostname.startsWith("app.");
  const isPublic = hostname.startsWith("synapseos.") || hostname.includes("localhost") || hostname.includes("vercel.app");

  // Extract tenant slug from subdomain (e.g. "mulago.synapseos.tech" -> "mulago")
  const subdomain = hostname.split(".")[0];
  const isTenantSubdomain =
    !isPlatformAdmin &&
    !isApp &&
    !isPublic &&
    subdomain !== "www" &&
    !hostname.includes("localhost");

  // Subdomain routing fires unconditionally — no auth env vars required
  if (isTenantSubdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/os/${subdomain}${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isPlatformAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = `/platform${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Guard: if Supabase env vars are not configured, skip auth and render the page
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  // Create supabase response to refresh session
  let supabaseResponse = NextResponse.next({ request });
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof supabaseResponse.cookies.set>[2];
  };

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // Protect OS routes
    const isOsRoute = pathname.startsWith("/os/") ||
      pathname.startsWith("/doctor/") ||
      pathname.startsWith("/nurse/") ||
      pathname.startsWith("/encounter/") ||
      pathname.startsWith("/lab/") ||
      pathname.startsWith("/pharmacy/") ||
      pathname.startsWith("/admin/") ||
      pathname.startsWith("/patient/") ||
      pathname.startsWith("/dept/") ||
      pathname.startsWith("/sdg") ||
      pathname.startsWith("/epidemiology");

    if (isOsRoute && !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname.startsWith("/platform") && !user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch {
    // Auth failure — let the request through rather than crashing
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|fonts|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
