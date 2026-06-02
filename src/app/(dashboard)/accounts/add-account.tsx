"use client"

import { useState, useTransition } from "react"
import { Plus, Loader2 } from "lucide-react"
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
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
  { value: "contra_asset", label: "Contra Asset" },
  { value: "contra_revenue", label: "Contra Revenue" },
  { value: "contra_liability", label: "Contra Liability" },
]

const normalBalances = [
  { value: "debit", label: "Debit" },
  { value: "credit", label: "Credit" },
]

const levels = [
  { value: 0, label: "Level 0 — Category" },
  { value: 1, label: "Level 1 — Major Group" },
  { value: 2, label: "Level 2 — Sub-Group" },
  { value: 3, label: "Level 3 — Account" },
  { value: 4, label: "Level 4 — Sub-Account" },
]

function AddAccountDialog({ accounts, onClose }: { accounts: Account[]; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    accountCode: "",
    accountName: "",
    accountType: "",
    normalBalance: "",
    level: 3,
    parentId: "",
    description: "",
  })

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

    if (formData.parentId) {
      payload.parentId = formData.parentId
    }
    if (formData.description) {
      payload.description = formData.description
    }

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

        onClose()
      } catch {
        setError("Failed to create account")
      }
    })
  }

  const eligibleParents = formData.level > 0
    ? accounts.filter((a) => a.level < formData.level && a.is_active)
    : []

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="accountCode">Account Code</Label>
        <Input
          id="accountCode"
          value={formData.accountCode}
          onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
          placeholder="e.g. 10100"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountName">Account Name</Label>
        <Input
          id="accountName"
          value={formData.accountName}
          onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
          placeholder="e.g. Cash on Hand"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="accountType">Account Type</Label>
          <Select
            value={formData.accountType}
            onValueChange={(v) => setFormData({ ...formData, accountType: v })}
          >
            <SelectTrigger id="accountType">
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
          <Label htmlFor="normalBalance">Normal Balance</Label>
          <Select
            value={formData.normalBalance}
            onValueChange={(v) => setFormData({ ...formData, normalBalance: v })}
          >
            <SelectTrigger id="normalBalance">
              <SelectValue placeholder="Select balance" />
            </SelectTrigger>
            <SelectContent>
              {normalBalances.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Level</Label>
          <Select
            value={String(formData.level)}
            onValueChange={(v) => setFormData({ ...formData, level: Number(v), parentId: "" })}
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
          <Label htmlFor="parentId">Parent Account</Label>
          <Select
            value={formData.parentId}
            onValueChange={(v) => setFormData({ ...formData, parentId: v })}
            disabled={formData.level === 0}
          >
            <SelectTrigger id="parentId">
              <SelectValue placeholder={formData.level === 0 ? "None (category)" : "Select parent"} />
            </SelectTrigger>
            <SelectContent>
              {eligibleParents.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.account_code} — {p.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
      </div>
    </form>
  )
}

export function AddAccount({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
        </DialogHeader>
        <AddAccountDialog accounts={accounts} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
