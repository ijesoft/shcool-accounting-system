import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicPaths = ["/api/v1/auth/login"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/dashboard")) {
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
  matcher: ["/api/:path*", "/dashboard/:path*"],
}
