import { timingSafeEqual, createHmac } from "crypto"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"

export function verifyServiceKey(request: NextRequest): boolean {
  const provided = request.headers.get("x-api-key") ?? ""
  const expected = process.env.INTEGRATION_API_KEY ?? ""
  if (!expected || provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

// Resolves the target entity schema for a service request. The caller may pin
// a schema via the x-entity-schema header; otherwise the first entity is used.
export async function resolveServiceSchema(request: NextRequest): Promise<string | null> {
  const requested = request.headers.get("x-entity-schema")
  if (requested) {
    const entity = await prisma.entity.findFirst({ where: { schemaName: requested } })
    return entity?.schemaName ?? null
  }
  const entity = await prisma.entity.findFirst({ orderBy: { createdAt: "asc" } })
  return entity?.schemaName ?? null
}

// Postings made through the integration API are attributed to this user.
export async function getServiceUserId(): Promise<string | null> {
  const email = process.env.INTEGRATION_USER_EMAIL || "admin@school.edu"
  const user = await prisma.user.findUnique({ where: { email } })
  if (user) return user.id
  const fallback = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } })
  return fallback?.id ?? null
}

export interface SsoPayload {
  email: string
  name: string
  role: string
  exp: number
}

export function verifySsoToken(token: string): SsoPayload | null {
  const secret = process.env.SSO_SHARED_SECRET
  if (!secret) return null
  const [payloadB64, signature] = token.split(".")
  if (!payloadB64 || !signature) return null
  const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url")
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as SsoPayload
    if (!payload.email || !payload.exp || payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}
