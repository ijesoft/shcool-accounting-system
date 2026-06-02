"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: string
}

const links: NavItem[] = [
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
  { href: "/payroll", label: "Payroll", icon: "💼" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/settings/fiscal-periods", label: "Fiscal Periods", icon: "📅" },
  { href: "/settings/fiscal-year-type", label: "Fiscal Year Type", icon: "📆" },
  { href: "/settings/revenue-recognition", label: "Rev. Recognition", icon: "📒" },
  { href: "/entities", label: "Branches", icon: "🏫" },
  { href: "/admin", label: "Admin", icon: "⚙️" },
]

const birLinks: NavItem[] = [
  { href: "/bir/form-2307", label: "BIR Form 2307", icon: "📄" },
  { href: "/bir/form-2316", label: "BIR Form 2316", icon: "📄" },
  { href: "/bir/sawt", label: "SAWT", icon: "📊" },
  { href: "/bir/slsp", label: "SLSP", icon: "📊" },
  { href: "/reports/fund-allocation", label: "Fund Allocation", icon: "🏦" },
  { href: "/reports/stof", label: "STOF", icon: "🎓" },
]

interface NavLinksProps {
  collapsed?: boolean
}

function NavItem({ link, pathname, collapsed }: { link: NavItem; pathname: string; collapsed?: boolean }) {
  const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"))
  return (
    <Link
      href={link.href}
      title={collapsed ? link.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <span className="flex-shrink-0">{link.icon}</span>
      {!collapsed && link.label}
    </Link>
  )
}

export function NavLinks({ collapsed = false }: NavLinksProps) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
      {links.map((link) => (
        <NavItem key={link.href} link={link} pathname={pathname} collapsed={collapsed} />
      ))}

      {!collapsed && (
        <div className="pt-4 pb-1">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            BIR Reports
          </p>
        </div>
      )}
      {collapsed && <div className="pt-4 pb-1 border-t" />}

      {birLinks.map((link) => (
        <NavItem key={link.href} link={link} pathname={pathname} collapsed={collapsed} />
      ))}
    </nav>
  )
}
