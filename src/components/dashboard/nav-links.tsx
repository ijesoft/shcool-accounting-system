"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/accounts", label: "Chart of Accounts", icon: "📋" },
  { href: "/dashboard/journal-entries", label: "Journal Entries", icon: "📝" },
  { href: "/dashboard/bank-reconciliation", label: "Bank Reconciliation", icon: "🔄" },
  { href: "/dashboard/cash-receipts", label: "Cash Receipts", icon: "💰" },
  { href: "/dashboard/cash-disbursements", label: "Cash Disbursements", icon: "💳" },
  { href: "/dashboard/official-receipts", label: "Official Receipts", icon: "🧾" },
  { href: "/dashboard/student-accounts", label: "Student Accounts", icon: "👨‍🎓" },
  { href: "/dashboard/vendor-accounts", label: "Vendor Accounts", icon: "🏢" },
  { href: "/dashboard/fixed-assets", label: "Fixed Assets", icon: "🏗️" },
  { href: "/dashboard/reports", label: "Reports", icon: "📈" },
  { href: "/dashboard/admin", label: "Admin", icon: "⚙️" },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === link.href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <span>{link.icon}</span>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
