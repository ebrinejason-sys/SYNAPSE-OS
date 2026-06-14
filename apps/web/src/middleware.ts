import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from '@synapse/auth/tokens'
import { SESSION_COOKIE } from '@synapse/config/constants'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

type PharmacyDomainLookup = {
  tenant_id?: string | null;
};

type TenantLookup = {
  slug?: string | null;
};

function standalonePharmacyUrl(request: NextRequest, tenantSlug: string) {
  const origin = (process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? "https://pharm.synapseos.tech").replace(/\/$/, "");
  const target = new URL("/login", origin);
  target.searchParams.set("tenant", tenantSlug);

  const redirectTo = request.nextUrl.searchParams.get("redirectTo");
  if (redirectTo) target.searchParams.set("redirectTo", redirectTo);

  return target;
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

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function isSessionStored(token: string, userId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return false;

  try {
    const tokenHash = await sha256Hex(token);
    const sessionUrl = new URL(`${supabaseUrl}/rest/v1/synapse_sessions`);
    sessionUrl.searchParams.set("token_hash", `eq.${tokenHash}`);
    sessionUrl.searchParams.set("select", "user_id,expires_at,revoked_at");
    sessionUrl.searchParams.set("limit", "1");

    const response = await fetch(sessionUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return false;
    const [session] = (await response.json()) as {
      user_id?: string | null;
      expires_at?: string | null;
      revoked_at?: string | null;
    }[];

    if (!session || session.user_id !== userId) return false;
    if (session.revoked_at) return false;
    if (!session.expires_at || new Date(session.expires_at) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
}

async function hasSynapseSession(request: NextRequest): Promise<{ valid: boolean; tenantId?: string }> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return { valid: false }
  try {
    const payload = await verifyToken(token)
    const stored = await isSessionStored(token, payload.sub)
    if (!stored) return { valid: false }
    return { valid: true, tenantId: payload.tenant_id ?? undefined }
  } catch {
    return { valid: false }
  }
}
async function isTenantActive(tenantId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return true;

  try {
    const tenantUrl = new URL(`${supabaseUrl}/rest/v1/tenants`);
    tenantUrl.searchParams.set("id", `eq.${tenantId}`);
    tenantUrl.searchParams.set("select", "is_active");
    tenantUrl.searchParams.set("limit", "1");
    const tenantResponse = await fetch(tenantUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: "no-store",
    });
    if (!tenantResponse.ok) return true;
    const [tenant] = (await tenantResponse.json()) as { is_active?: boolean | null }[];
    return tenant?.is_active !== false;
  } catch {
    return true;
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
      return NextResponse.redirect(standalonePharmacyUrl(request, pharmacyDomain.slug));
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
    const isAuthPage =
      platformPath === "/platform/login" ||
      platformPath === "/platform/mfa" ||
      platformPath === "/platform/mfa-verify";

    const { valid: synapseValid } = await hasSynapseSession(request)

    if (synapseValid && ADMIN_EMAILS.length > 0 && !isAuthPage) {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (token) {
        try {
          const payload = await verifyToken(token);
          if (!ADMIN_EMAILS.includes(payload.email)) {
            const url = request.nextUrl.clone();
            url.pathname = "/platform/login";
            url.searchParams.set("error", "unauthorized");
            return NextResponse.rewrite(url);
          }
        } catch {
          const url = request.nextUrl.clone();
          url.pathname = "/platform/login";
          return NextResponse.rewrite(url);
        }
      }
    }

    if (!synapseValid && !isAuthPage) {
      // Check for MFA-pending cookie — user completed OTP but not TOTP yet
      const mfaPending = request.cookies.get('synapse_mfa_pending')?.value
      const url = request.nextUrl.clone()
      if (mfaPending) {
        // Determine if user needs to set up or just verify TOTP.
        // We can't decrypt the JWT in middleware (Edge), so redirect to mfa-verify.
        // The route itself will redirect to mfa-setup if enrollment is missing.
        url.pathname = '/platform/mfa-verify'
      } else {
        url.pathname = '/platform/login'
      }
      return NextResponse.rewrite(url)
    }

    const url = request.nextUrl.clone();
    url.pathname = platformPath;
    return NextResponse.rewrite(url);
  }

  // ── HOSPITAL subdomain: tenant portal ─────────────────────────────
  if (subdomain.startsWith("pharm-")) {
    const pharmacySlug = subdomain.replace(/^pharm-/, "");
    return NextResponse.redirect(standalonePharmacyUrl(request, `pharm-${pharmacySlug}`));
  }

  if (subdomain && subdomain !== "www" && subdomain !== "synapseos") {
    const response = NextResponse.rewrite(
      new URL(`/os/${subdomain}${pathname === "/" ? "" : pathname}`, request.url)
    );
    response.headers.set("x-hospital-subdomain", subdomain);
    return response;
  }

  const { valid: synapseValid, tenantId: synapseTenantId } = await hasSynapseSession(request)

  const isProtected =
    pathname.startsWith("/os/") ||
    pathname.startsWith("/doctor/") ||
    pathname.startsWith("/nurse/") ||
    pathname.startsWith("/encounter/") ||
    pathname.startsWith("/lab/") ||
    pathname.startsWith("/pharmacy/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/patient/");

  if (isProtected && !synapseValid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected && synapseValid && synapseTenantId) {
    const tenantActive = await isTenantActive(synapseTenantId);
    if (!tenantActive) {
      return NextResponse.redirect(new URL("/login?error=account_inactive", request.url));
    }
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
