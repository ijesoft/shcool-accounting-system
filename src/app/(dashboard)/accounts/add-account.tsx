"use client"

import { useState, useTransition } from "react"
import { Plus, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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

const accountTypes = [
  { value: "asset", label: "Asset", normalBalance: "debit" },
  { value: "liability", label: "Liability", normalBalance: "credit" },
  { value: "equity", label: "Equity", normalBalance: "credit" },
  { value: "revenue", label: "Revenue", normalBalance: "credit" },
  { value: "expense", label: "Expense", normalBalance: "debit" },
  { value: "contra_asset", label: "Contra Asset", normalBalance: "credit" },
  { value: "contra_revenue", label: "Contra Revenue", normalBalance: "debit" },
  { value: "contra_liability", label: "Contra Liability", normalBalance: "debit" },
]

const levels = [
  { value: 0, label: "Level 0 — Category" },
  { value: 1, label: "Level 1 — Major Group" },
  { value: 2, label: "Level 2 — Sub-Group" },
  { value: 3, label: "Level 3 — Postable Account" },
  { value: 4, label: "Level 4 — Sub-Account" },
]

// Which account_types belong to each parent category
const typeToCategory: Record<string, string> = {
  asset: "asset",
  contra_asset: "asset",
  liability: "liability",
  contra_liability: "liability",
  equity: "equity",
  revenue: "revenue",
  contra_revenue: "revenue",
  expense: "expense",
}

function AddAccountDialog({
  accounts,
  defaultType,
  onClose,
}: {
  accounts: Account[]
  defaultType?: string
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  const defaultNormalBalance =
    accountTypes.find((t) => t.value === defaultType)?.normalBalance ?? ""

  const [formData, setFormData] = useState({
    accountCode: "",
    accountName: "",
    accountType: defaultType ?? "",
    normalBalance: defaultNormalBalance,
    level: 3,
    parentId: "",
    description: "",
  })

  // Auto-set normal balance when type changes
  const handleTypeChange = (value: string) => {
    const matched = accountTypes.find((t) => t.value === value)
    setFormData((prev) => ({
      ...prev,
      accountType: value,
      normalBalance: matched?.normalBalance ?? prev.normalBalance,
      parentId: "",
    }))
  }

  // Filter parents: same category as selected type, lower level
  const eligibleParents = formData.accountType
    ? accounts.filter((a) => {
        const sameCategory =
          typeToCategory[a.account_type] === typeToCategory[formData.accountType]
        return sameCategory && a.level < formData.level && a.is_active
      })
    : accounts.filter((a) => a.level < formData.level && a.is_active)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const payload: Record<string, unknown> = {
      accountCode: formData.accountCode,
      accountName: formData.accountName,
      accountType: formData.accountType,
      normalBalance: formData.normalBalance,
      level: formData.level,
    }
    if (formData.parentId) payload.parentId = formData.parentId
    if (formData.description) payload.description = formData.description

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error?.message || "Failed to create account")
          return
        }
        router.refresh()
        onClose()
      } catch {
        setError("Failed to create account")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="accountCode">Account Code</Label>
          <Input
            id="accountCode"
            value={formData.accountCode}
            onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
            placeholder="e.g. 11150"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accountName">Account Name</Label>
          <Input
            id="accountName"
            value={formData.accountName}
            onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
            placeholder="e.g. Petty Cash Fund"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Account Type</Label>
          <Select value={formData.accountType} onValueChange={handleTypeChange} required>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {accountTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Normal Balance</Label>
          <Select
            value={formData.normalBalance}
            onValueChange={(v) => setFormData({ ...formData, normalBalance: v })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debit">Debit</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Level</Label>
          <Select
            value={String(formData.level)}
            onValueChange={(v) =>
              setFormData({ ...formData, level: Number(v), parentId: "" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {levels.map((l) => (
                <SelectItem key={l.value} value={String(l.value)}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Parent Account</Label>
          <Select
            value={formData.parentId}
            onValueChange={(v) => setFormData({ ...formData, parentId: v })}
            disabled={formData.level === 0 || eligibleParents.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  formData.level === 0
                    ? "None (top-level)"
                    : eligibleParents.length === 0
                    ? "Select type first"
                    : "Select parent"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {eligibleParents.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {p.account_code}
                  </span>
                  {p.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this account"
          rows={2}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create Account
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export function AddAccount({
  accounts,
  defaultType,
  variant = "default",
}: {
  accounts: Account[]
  defaultType?: string
  variant?: "default" | "ghost" | "inline"
}) {
  const [open, setOpen] = useState(false)

  const label = defaultType
    ? `Add ${accountTypes.find((t) => t.value === defaultType)?.label ?? "Account"}`
    : "Add Account"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "inline" ? (
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-muted/60"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        ) : (
          <Button variant={variant === "ghost" ? "ghost" : "default"} size={variant === "ghost" ? "sm" : "default"}>
            <Plus className="mr-2 h-4 w-4" />
            {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <AddAccountDialog
          accounts={accounts}
          defaultType={defaultType}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
