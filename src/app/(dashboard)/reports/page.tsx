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
    href: "/reports/trial-balance",
    title: "Trial Balance",
    description: "List of all accounts with debit/credit balances for a given period.",
  },
  {
    href: "/reports/income-statement",
    title: "Statement of Comprehensive Income",
    description: "PFRS revenue and expense summary showing profit or loss for a date range (formerly Income Statement).",
  },
  {
    href: "/reports/balance-sheet",
    title: "Statement of Financial Position",
    description: "PFRS statement showing assets, liabilities, and equity as of a specific date (formerly Balance Sheet).",
  },
  {
    href: "/reports/changes-in-equity",
    title: "Statement of Changes in Equity",
    description: "PFRS statement tracking beginning balance, net income, other changes, and ending balance of equity accounts.",
  },
  {
    href: "/reports/cash-flow",
    title: "Statement of Cash Flows",
    description: "Cash inflows and outflows from operating, investing, and financing activities.",
  },
  {
    href: "/reports/ar-aging",
    title: "Accounts Receivable Aging",
    description: "Student receivables by aging bucket for collections follow-up.",
  },
  {
    href: "/reports/unearned-tuition",
    title: "Unearned Tuition Roll-Forward",
    description: "Deferred tuition billings, revenue recognized, and closing unearned balance.",
  },
]

export default async function ReportsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")

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
