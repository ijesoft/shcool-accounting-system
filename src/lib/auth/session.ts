import { getIronSession, IronSession } from "iron-session"
import { cookies } from "next/headers"

export interface SessionData {
  userId: string
  email: string
  fullName: string
  roleId: string
  roleName: string
  entityId?: string
  isActive: boolean
}

// COOKIE_SECURE=true only when the app is served over HTTPS.
// When accessing over plain HTTP (e.g. http://ubuntu-desktop:3002),
// browsers refuse to send Secure cookies, breaking every server
// component session check after the router cache expires (~1 min).
const isSecure = process.env.COOKIE_SECURE === "true"

const sessionOptions = {
  password: process.env.SESSION_SECRET || "change-me-to-a-random-32-char-string-at-least",
  cookieName: "school_acct_session",
  ttl: 60 * 60 * 8, // 8-hour seal TTL (iron-session encrypts this into the cookie)
  cookieOptions: {
    secure: isSecure,
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 8, // 8 hours — matches ttl so cookie and seal expire together
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session
}

export async function destroySession(): Promise<void> {
  const session = await getSession()
  session.destroy()
}
