"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

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

const categoryMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
  asset: {
    label: "Assets",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  liability: {
    label: "Liabilities",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  equity: {
    label: "Equity",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  revenue: {
    label: "Revenue",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  expense: {
    label: "Expenses",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
}

const typeColors: Record<string, string> = {
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
  const roots: TreeNode[] = []

  accounts.forEach((acc) => {
    map.set(acc.id, { ...acc, children: [] })
  })

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

function groupByCategory(tree: TreeNode[]): Record<string, TreeNode[]> {
  const groups: Record<string, TreeNode[]> = {}

  tree.forEach((node) => {
    const key = node.account_type
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(node)
  })

  return groups
}

function AccountNode({ account, depth }: { account: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = account.children.length > 0

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 hover:bg-muted/40 rounded cursor-pointer transition-colors ${!account.is_active ? "opacity-50" : ""}`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </span>
        <span className="font-mono text-xs font-medium text-muted-foreground w-16 flex-shrink-0">
          {account.account_code}
        </span>
        <span className="text-sm text-foreground flex-1">
          {account.account_name}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColors[account.account_type] || "bg-gray-100 text-gray-600"}`}>
          {account.account_type.replace("_", " ")}
        </span>
        {!account.is_active && (
          <span className="text-[10px] text-red-500 font-medium flex-shrink-0">Inactive</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {account.children.map((child) => (
            <AccountNode key={child.id} account={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function CategorySection({ category, nodes }: { category: string; nodes: TreeNode[] }) {
  const [expanded, setExpanded] = useState(true)
  const info = categoryMap[category] || {
    label: category.replace("_", " ").toUpperCase(),
    color: "text-gray-700",
    bg: "bg-gray-50",
    border: "border-gray-200",
  }

  const count = (nodes: TreeNode[]): number => {
    let c = nodes.length
    nodes.forEach((n) => {
      if (n.children.length) c += count(n.children)
    })
    return c
  }

  return (
    <div className={`border ${info.border} rounded-lg mb-3`}>
      <div
        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none ${info.bg}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-5 h-5 flex items-center justify-center">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <span className={`text-sm font-semibold ${info.color}`}>{info.label}</span>
        <span className="text-xs text-muted-foreground bg-white/60 px-2 py-0.5 rounded-full">
          {count(nodes)} accounts
        </span>
      </div>
      {expanded && (
        <div className="px-2 pb-2">
          {nodes.map((node) => (
            <AccountNode key={node.id} account={node} depth={0} />
          ))}
        </div>
      )}
    </div>
  )
}

export function AccountTreeView({ accounts }: { accounts: Account[] }) {
  const tree = buildTree(accounts)
  const groups = groupByCategory(tree)

  const categoryOrder = ["asset", "liability", "equity", "revenue", "expense"]

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4">
        {categoryOrder.map((cat) => {
          if (!groups[cat]) return null
          return <CategorySection key={cat} category={cat} nodes={groups[cat]} />
        })}
        {Object.keys(groups).filter((k) => !categoryOrder.includes(k)).map((cat) => (
          <CategorySection key={cat} category={cat} nodes={groups[cat]} />
        ))}
      </div>
    </div>
  )
}
