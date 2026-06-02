"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { AddAccount } from "./add-account"

interface Account {
  id: string
  account_code: string
  account_name: string
  account_type: string
  normal_balance: string
  level: number
  is_active: boolean
  parent_id: string | null
}

type TreeNode = Account & { children: TreeNode[] }

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; headerBg: string; countBg: string }
> = {
  asset: {
    label: "Assets",
    color: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    headerBg: "bg-emerald-50 hover:bg-emerald-100",
    countBg: "bg-emerald-100 text-emerald-700",
  },
  liability: {
    label: "Liabilities",
    color: "text-orange-800",
    bg: "bg-orange-50",
    border: "border-orange-200",
    headerBg: "bg-orange-50 hover:bg-orange-100",
    countBg: "bg-orange-100 text-orange-700",
  },
  equity: {
    label: "Equity",
    color: "text-blue-800",
    bg: "bg-blue-50",
    border: "border-blue-200",
    headerBg: "bg-blue-50 hover:bg-blue-100",
    countBg: "bg-blue-100 text-blue-700",
  },
  revenue: {
    label: "Revenue",
    color: "text-green-800",
    bg: "bg-green-50",
    border: "border-green-200",
    headerBg: "bg-green-50 hover:bg-green-100",
    countBg: "bg-green-100 text-green-700",
  },
  expense: {
    label: "Expenses",
    color: "text-red-800",
    bg: "bg-red-50",
    border: "border-red-200",
    headerBg: "bg-red-50 hover:bg-red-100",
    countBg: "bg-red-100 text-red-700",
  },
}

const TYPE_BADGE: Record<string, string> = {
  asset: "bg-emerald-100 text-emerald-700",
  liability: "bg-orange-100 text-orange-700",
  equity: "bg-blue-100 text-blue-700",
  revenue: "bg-green-100 text-green-700",
  expense: "bg-red-100 text-red-700",
  contra_asset: "bg-rose-100 text-rose-700",
  contra_revenue: "bg-pink-100 text-pink-700",
  contra_liability: "bg-amber-100 text-amber-700",
}

function buildTree(accounts: Account[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  accounts.forEach((acc) => map.set(acc.id, { ...acc, children: [] }))
  const roots: TreeNode[] = []
  accounts.forEach((acc) => {
    const node = map.get(acc.id)!
    if (acc.parent_id && map.has(acc.parent_id)) {
      map.get(acc.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function countAll(nodes: TreeNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countAll(n.children), 0)
}

function groupByCategory(roots: TreeNode[]): Record<string, TreeNode[]> {
  const groups: Record<string, TreeNode[]> = {}
  roots.forEach((node) => {
    const key = node.account_type
    if (!groups[key]) groups[key] = []
    groups[key].push(node)
  })
  return groups
}

function AccountNode({
  account,
  depth,
  allAccounts,
}: {
  account: TreeNode
  depth: number
  allAccounts: Account[]
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = account.children.length > 0

  return (
    <div>
      <div
        className={`group flex items-center gap-2 py-1.5 pr-3 hover:bg-muted/40 rounded transition-colors ${
          !account.is_active ? "opacity-50" : ""
        }`}
        style={{ paddingLeft: `${depth * 20 + 10}px` }}
      >
        {/* expand / leaf indicator */}
        <button
          className="w-5 h-5 flex items-center justify-center flex-shrink-0"
          onClick={() => setExpanded((v) => !v)}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
          )}
        </button>

        {/* code */}
        <span className="font-mono text-xs font-medium text-muted-foreground w-14 flex-shrink-0">
          {account.account_code}
        </span>

        {/* name */}
        <span className="text-sm flex-1 truncate">{account.account_name}</span>

        {/* type badge — only for non-standard types */}
        {account.account_type.startsWith("contra_") && (
          <span
            className={`hidden group-hover:inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
              TYPE_BADGE[account.account_type] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {account.account_type.replace("_", " ")}
          </span>
        )}

        {/* normal balance */}
        <span className="hidden group-hover:inline-block text-[10px] text-muted-foreground flex-shrink-0">
          {account.normal_balance}
        </span>

        {!account.is_active && (
          <span className="text-[10px] text-red-500 font-medium flex-shrink-0">Inactive</span>
        )}

        {/* inline add sub-account — shown on hover */}
        <span className="opacity-0 group-hover:opacity-100 flex-shrink-0">
          <AddAccount
            accounts={allAccounts}
            defaultType={account.account_type}
            variant="inline"
          />
        </span>
      </div>

      {expanded && hasChildren && (
        <div>
          {account.children.map((child) => (
            <AccountNode
              key={child.id}
              account={child}
              depth={depth + 1}
              allAccounts={allAccounts}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategorySection({
  category,
  nodes,
  allAccounts,
}: {
  category: string
  nodes: TreeNode[]
  allAccounts: Account[]
}) {
  const [expanded, setExpanded] = useState(true)
  const cfg = CATEGORY_CONFIG[category] ?? {
    label: category.replace("_", " ").toUpperCase(),
    color: "text-gray-700",
    bg: "bg-gray-50",
    border: "border-gray-200",
    headerBg: "bg-gray-50 hover:bg-gray-100",
    countBg: "bg-gray-100 text-gray-600",
  }
  const total = countAll(nodes)

  return (
    <div className={`border ${cfg.border} rounded-xl mb-3 overflow-hidden`}>
      {/* Section header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${cfg.headerBg}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          {expanded ? (
            <ChevronDown className={`h-4 w-4 ${cfg.color}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${cfg.color}`} />
          )}
        </span>

        <span className={`text-sm font-bold tracking-wide ${cfg.color}`}>
          {cfg.label}
        </span>

        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.countBg}`}>
          {total} account{total !== 1 ? "s" : ""}
        </span>

        <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <AddAccount
            accounts={allAccounts}
            defaultType={category}
            variant="inline"
          />
        </span>
      </div>

      {/* Accounts list */}
      {expanded && (
        <div className="bg-card px-2 pb-2 pt-1">
          {nodes.map((node) => (
            <AccountNode
              key={node.id}
              account={node}
              depth={0}
              allAccounts={allAccounts}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const CATEGORY_ORDER = ["asset", "liability", "equity", "revenue", "expense"]

export function AccountTreeView({ accounts }: { accounts: Account[] }) {
  const tree = buildTree(accounts)
  const groups = groupByCategory(tree)
  const extras = Object.keys(groups).filter((k) => !CATEGORY_ORDER.includes(k))

  return (
    <div className="space-y-1">
      {[...CATEGORY_ORDER, ...extras].map((cat) => {
        if (!groups[cat]) return null
        return (
          <CategorySection
            key={cat}
            category={cat}
            nodes={groups[cat]}
            allAccounts={accounts}
          />
        )
      })}
    </div>
  )
}
