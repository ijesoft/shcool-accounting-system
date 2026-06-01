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

const sessionOptions = {
  password: process.env.SESSION_SECRET || "change-me-to-a-random-32-char-string-at-least",
  cookieName: "school_acct_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 8,
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
