import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"

const reportLinks = [
  {
    href: "/dashboard/reports/trial-balance",
    title: "Trial Balance",
    description: "List of all accounts with debit/credit balances for a given period.",
  },
  {
    href: "/dashboard/reports/income-statement",
    title: "Income Statement",
    description: "Revenue and expense summary showing profit/loss for a date range.",
  },
  {
    href: "/dashboard/reports/balance-sheet",
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity as of a specific date.",
  },
  {
    href: "/dashboard/reports/cash-flow",
    title: "Cash Flow Statement",
    description: "Cash inflows and outflows from operating, investing, and financing activities.",
  },
]

export default async function ReportsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Financial Reports</h1>
      <p className="text-muted-foreground">Select a report to view or export.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {reportLinks.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-blue-600">View Report →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
