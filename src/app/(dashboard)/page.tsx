import { getSession } from "@/lib/auth/session"

export default async function DashboardPage() {
  const session = await getSession()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back, {session.fullName}
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Accounts</p>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Journal Entries</p>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending Invoices</p>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Bank Balance</p>
          <p className="text-2xl font-bold">--</p>
        </div>
      </div>
    </div>
  )
}
