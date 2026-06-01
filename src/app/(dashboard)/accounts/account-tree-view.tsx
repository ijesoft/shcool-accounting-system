"use client"

import { useState } from "react"

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

function AccountNode({ account, depth }: { account: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = account.children.length > 0

  const typeColors: Record<string, string> = {
    asset: "text-emerald-600",
    liability: "text-orange-600",
    equity: "text-blue-600",
    revenue: "text-green-600",
    expense: "text-red-600",
    contra_asset: "text-rose-600",
    contra_revenue: "text-pink-600",
    contra_liability: "text-amber-600",
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 text-center text-xs text-muted-foreground">
          {hasChildren ? (expanded ? "▼" : "▶") : "·"}
        </span>
        <span className="font-mono text-xs text-muted-foreground w-16">{account.account_code}</span>
        <span className={`text-sm ${typeColors[account.account_type] || ""}`}>
          {account.account_name}
        </span>
        <span className="text-xs text-muted-foreground ml-2">
          ({account.account_type}, {account.normal_balance})
        </span>
        {!account.is_active && (
          <span className="text-xs text-red-500 ml-2">Inactive</span>
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

export function AccountTreeView({ accounts }: { accounts: Account[] }) {
  const tree = buildTree(accounts)

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4">
        <AccountNode
          account={{
            id: "root",
            account_code: "",
            account_name: "Chart of Accounts",
            account_type: "",
            normal_balance: "",
            level: -1,
            is_active: true,
            parent_id: null,
            children: tree,
          }}
          depth={-1}
        />
      </div>
    </div>
  )
}
