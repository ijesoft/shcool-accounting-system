import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { Sidebar } from "@/components/dashboard/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session.userId) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        fullName={session.fullName}
        roleName={session.roleName}
        entityId={session.entityId}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  )
}
