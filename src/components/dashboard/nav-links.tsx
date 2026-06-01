"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/accounts", label: "Chart of Accounts", icon: "📋" },
  { href: "/journal-entries", label: "Journal Entries", icon: "📝" },
  { href: "/bank-reconciliation", label: "Bank Reconciliation", icon: "🔄" },
  { href: "/cash-receipts", label: "Cash Receipts", icon: "💰" },
  { href: "/cash-disbursements", label: "Cash Disbursements", icon: "💳" },
  { href: "/official-receipts", label: "Official Receipts", icon: "🧾" },
  { href: "/student-accounts", label: "Student Accounts", icon: "👨‍🎓" },
  { href: "/vendor-accounts", label: "Vendor Accounts", icon: "🏢" },
  { href: "/fixed-assets", label: "Fixed Assets", icon: "🏗️" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/entities", label: "Branches", icon: "🏫" },
  { href: "/admin", label: "Admin", icon: "⚙️" },
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
