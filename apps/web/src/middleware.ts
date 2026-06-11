import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

type PharmacyDomainLookup = {
  tenant_id?: string | null;
};

type TenantLookup = {
  slug?: string | null;
};

function pharmacyPath(pathname: string) {
  if (pathname === "/") return "/pharmacy/queue";
  if (pathname.startsWith("/pharmacy")) return pathname;
  return `/pharmacy${pathname}`;
}

async function resolvePharmacyCustomDomain(hostname: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const profileUrl = new URL(`${supabaseUrl}/rest/v1/pharmacy_profiles`);
    profileUrl.searchParams.set("custom_domain", `eq.${hostname}`);
    profileUrl.searchParams.set("select", "tenant_id");
    profileUrl.searchParams.set("limit", "1");
    const profileResponse = await fetch(profileUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: "no-store",
    });
    if (!profileResponse.ok) return null;
    const [profile] = (await profileResponse.json()) as PharmacyDomainLookup[];
    if (!profile?.tenant_id) return null;

    const tenantUrl = new URL(`${supabaseUrl}/rest/v1/tenants`);
    tenantUrl.searchParams.set("id", `eq.${profile.tenant_id}`);
    tenantUrl.searchParams.set("select", "slug");
    tenantUrl.searchParams.set("limit", "1");
    const tenantResponse = await fetch(tenantUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: "no-store",
    });
    if (!tenantResponse.ok) return null;
    const [tenant] = (await tenantResponse.json()) as TenantLookup[];

    return {
      tenantId: profile.tenant_id,
      slug: tenant?.slug?.replace(/^pharm-/, "") ?? hostname,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isLocal = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const parts = hostname.split(".");
  const rawSubdomain = parts[0] ?? "";

  const isSynapseManagedDomain =
    hostname === "synapseos.tech" ||
    hostname === "www.synapseos.tech" ||
    hostname.endsWith(".synapseos.tech");

  const isRootDomain =
    hostname.startsWith("synapseos.") ||
    hostname.startsWith("www.") ||
    isLocal ||
    hostname.includes("vercel.app");

  const subdomain = isRootDomain ? (request.nextUrl.searchParams.get("subdomain") ?? "") : rawSubdomain;

  if (!isLocal && !hostname.includes("vercel.app") && !isSynapseManagedDomain) {
    const pharmacyDomain = await resolvePharmacyCustomDomain(hostname);
    if (pharmacyDomain) {
      const response = NextResponse.rewrite(
        new URL(pharmacyPath(pathname), request.url)
      );
      response.headers.set("x-pharmacy-custom-domain", hostname);
      response.headers.set("x-pharmacy-tenant-id", pharmacyDomain.tenantId);
      response.headers.set("x-pharmacy-subdomain", pharmacyDomain.slug);
      return response;
    }
  }

  // ── DEMO subdomain ────────────────────────────────────────────────
  if (subdomain === "demo") {
    const url = request.nextUrl.clone();
    url.pathname = `/demo${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── APP subdomain ─────────────────────────────────────────────────
  if (subdomain === "app") {
    const url = request.nextUrl.clone();
    url.pathname = `/app-portal${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── ADMIN subdomain: email-gated ──────────────────────────────────
  if (subdomain === "admin") {
    const platformPath = pathname.startsWith("/platform")
      ? pathname
      : `/platform${pathname === "/" ? "" : pathname}`;
    const isAuthPage = platformPath === "/platform/login" || platformPath === "/platform/mfa";

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const url = request.nextUrl.clone();
      url.pathname = platformPath;
      return NextResponse.rewrite(url);
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/platform/login";
      return NextResponse.rewrite(url);
    }
    if (user && ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(user.email ?? "") && !isAuthPage) {
      return NextResponse.redirect(new URL("https://synapseos.tech?e=403", request.url));
    }

    const url = request.nextUrl.clone();
    url.pathname = platformPath;
    return NextResponse.rewrite(url);
  }

  // ── HOSPITAL subdomain: tenant portal ─────────────────────────────
  if (subdomain.startsWith("pharm-")) {
    const pharmacySlug = subdomain.replace(/^pharm-/, "");
    const response = NextResponse.rewrite(
      new URL(pharmacyPath(pathname), request.url)
    );
    response.headers.set("x-pharmacy-subdomain", pharmacySlug);
    return response;
  }

  if (subdomain && subdomain !== "www" && subdomain !== "synapseos") {
    const response = NextResponse.rewrite(
      new URL(`/os/${subdomain}${pathname === "/" ? "" : pathname}`, request.url)
    );
    response.headers.set("x-hospital-subdomain", subdomain);
    return response;
  }

  // ── Root domain: session refresh ──────────────────────────────────
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  type CookieToSet = { name: string; value: string; options?: Parameters<typeof supabaseResponse.cookies.set>[2] };

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
            cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();

    const isProtected =
      pathname.startsWith("/os/") ||
      pathname.startsWith("/doctor/") ||
      pathname.startsWith("/nurse/") ||
      pathname.startsWith("/encounter/") ||
      pathname.startsWith("/lab/") ||
      pathname.startsWith("/pharmacy/") ||
      pathname.startsWith("/admin/") ||
      pathname.startsWith("/patient/");

    if (isProtected && !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isProtected && user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, is_admin, role")
        .eq("id", user.id)
        .maybeSingle();

      const isPrivileged = profile?.is_admin || profile?.role === "platform_admin";

      if (profile && !isPrivileged && profile.tenant_id) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("is_active")
          .eq("id", profile.tenant_id)
          .maybeSingle();

        if (!tenant || !tenant.is_active) {
          return NextResponse.redirect(new URL("/login?error=account_inactive", request.url));
        }
      }
    }
  } catch {
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
