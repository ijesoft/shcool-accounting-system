import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// /api/v1/auth/sso is token-validated and /api/v1/integration/* is
// API-key-validated inside their route handlers (see lib/auth/service-auth.ts),
// so they bypass the session-cookie gate here.
const publicPaths = ["/api/v1/auth/login", "/api/v1/auth/sso", "/api/v1/integration/", "/login"]

const protectedPaths = [
  "/",
  "/accounts",
  "/journal-entries",
  "/bank-reconciliation",
  "/cash-receipts",
  "/cash-disbursements",
  "/official-receipts",
  "/student-accounts",
  "/vendor-accounts",
  "/fixed-assets",
  "/reports",
  "/admin",
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect /dashboard to /
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (
    pathname.startsWith("/api/") ||
    protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const sessionCookie = request.cookies.get("school_acct_session")
    if (!sessionCookie) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, data: null, error: { code: "ERR_UNAUTHORIZED", message: "Not authenticated" } },
          { status: 401 }
        )
      }
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*", "/", "/accounts/:path*", "/journal-entries/:path*", "/bank-reconciliation/:path*", "/cash-receipts/:path*", "/cash-disbursements/:path*", "/official-receipts/:path*", "/student-accounts/:path*", "/vendor-accounts/:path*", "/fixed-assets/:path*", "/reports/:path*", "/admin/:path*"],
}
