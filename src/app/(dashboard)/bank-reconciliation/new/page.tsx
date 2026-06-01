"use client"

import { useState, useEffect, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function NewBankReconciliationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)

  const [showAddAccount, setShowAddAccount] = useState(false)
  const [accountForm, setAccountForm] = useState({ bankName: "", accountNumber: "", accountType: "checking" })
  const [accountCreating, setAccountCreating] = useState(false)

  useEffect(() => {
    fetch("/api/v1/bank-accounts", { credentials: "include" })
      .then(r => r.json())
      .then(res => { setBankAccounts(res.data || []); setAccountsLoading(false) })
      .catch(() => { setAccountsLoading(false) })
  }, [])

  async function handleCreateAccount(e: FormEvent) {
    e.preventDefault()
    setAccountCreating(true)
    try {
      const res = await fetch("/api/v1/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(accountForm),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || "Failed") }
      const r = await res.json()
      setBankAccounts(prev => [...prev, r.data])
      setShowAddAccount(false)
      setAccountForm({ bankName: "", accountNumber: "", accountType: "checking" })
    } catch (err: any) { setError(err.message) }
    finally { setAccountCreating(false) }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/v1/bank-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bankAccountId: form.get("bankAccountId"),
          statementDate: form.get("statementDate"),
          statementEndingBalance: Number(form.get("statementEndingBalance")),
          bookEndingBalance: Number(form.get("bookEndingBalance")),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed to start reconciliation")
      }
      const result = await res.json()
      router.push(`/bank-reconciliation/${result.data.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">New Bank Reconciliation</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {accountsLoading ? (
        <p className="text-muted-foreground">Loading bank accounts...</p>
      ) : bankAccounts.length === 0 && !showAddAccount ? (
        <div className="rounded-lg border bg-card p-6 text-center space-y-4">
          <p className="text-muted-foreground">No bank accounts found. Add one to start a reconciliation.</p>
          <Button onClick={() => setShowAddAccount(true)}>Add Bank Account</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bankAccountId">Bank Account</Label>
            <select
              id="bankAccountId"
              name="bankAccountId"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">Select a bank account</option>
              {bankAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.bank_name} — {a.account_number}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddAccount(!showAddAccount)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showAddAccount ? "Cancel" : "+ Add another bank account"}
            </button>
          </div>

          {showAddAccount && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">New Bank Account</p>
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={accountForm.bankName}
                  onChange={e => setAccountForm(f => ({ ...f, bankName: e.target.value }))}
                  placeholder="e.g. BDO"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={accountForm.accountNumber}
                  onChange={e => setAccountForm(f => ({ ...f, accountNumber: e.target.value }))}
                  placeholder="e.g. 1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <select
                  id="accountType"
                  value={accountForm.accountType}
                  onChange={e => setAccountForm(f => ({ ...f, accountType: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="money_market">Money Market</option>
                </select>
              </div>
              <Button
                type="button"
                onClick={handleCreateAccount}
                disabled={accountCreating || !accountForm.bankName || !accountForm.accountNumber}
                size="sm"
              >
                {accountCreating ? "Creating..." : "Save Account"}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="statementDate">Statement Date</Label>
            <Input id="statementDate" name="statementDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="statementEndingBalance">Statement Ending Balance (PHP)</Label>
            <Input id="statementEndingBalance" name="statementEndingBalance" type="number" step="0.01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookEndingBalance">Book Ending Balance (PHP)</Label>
            <Input id="bookEndingBalance" name="bookEndingBalance" type="number" step="0.01" required />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating..." : "Start Reconciliation"}
          </Button>
        </form>
      )}
    </div>
  )
}
