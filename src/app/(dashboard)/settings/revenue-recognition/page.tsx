import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getEntitySettings } from "@/lib/entity-settings"
import { RevenueRecognitionSettings } from "./settings-form"

export const dynamic = "force-dynamic"

export default async function RevenueRecognitionSettingsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!session.entityId) {
    return <p className="p-6 text-muted-foreground">Please select an entity.</p>
  }
  if (!hasPermission(session.roleName, "entities", "update")) {
    redirect("/")
  }

  const settings = await getEntitySettings(session.entityId)

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/settings/fiscal-periods" className="text-sm text-blue-600 hover:underline">
        &larr; Settings
      </Link>
      <h1 className="text-3xl font-bold">Accounting Settings</h1>
      <RevenueRecognitionSettings
        entityId={session.entityId}
        initialMethod={settings.revenueRecognitionMethod ?? "term_straight_line"}
      />
    </div>
  )
}
