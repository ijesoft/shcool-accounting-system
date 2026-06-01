"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function NewDisbursementPage() {
  const router = useRouter()
  const [cvDate, setCvDate] = useState(new Date().toISOString().split("T")[0])
  const [payeeType, setPayeeType] = useState("vendor")
  const [payeeName, setPayeeName] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("check")
  const [checkNumber, setCheckNumber] = useState("")
  const [checkDate, setCheckDate] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [withholdingTaxRate, setWithholdingTaxRate] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/v1/cash-disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvDate,
          payeeType,
          payeeName,
          amount: parseFloat(amount),
          paymentMethod,
          checkNumber: checkNumber || undefined,
          checkDate: checkDate || undefined,
          bankAccount: bankAccount || undefined,
          withholdingTaxRate: withholdingTaxRate ? parseFloat(withholdingTaxRate) : undefined,
          description: description || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || "Failed") }
      router.push("/cash-disbursements")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const numAmount = parseFloat(amount) || 0
  const wtRate = parseFloat(withholdingTaxRate) || 0
  const wtAmount = wtRate > 0 ? (numAmount * wtRate / 100) : 0
  const netAmount = numAmount - wtAmount

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">New Cash Disbursement</h1>
      <Card>
        <CardHeader><CardTitle>Disbursement Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cvDate">CV Date</Label>
              <Input id="cvDate" type="date" value={cvDate} onChange={e => setCvDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payeeType">Payee Type</Label>
              <select id="payeeType" value={payeeType} onChange={e => setPayeeType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="vendor">Vendor</option>
                <option value="employee">Employee</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payeeName">Payee Name</Label>
              <Input id="payeeName" value={payeeName} onChange={e => setPayeeName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            {paymentMethod === "check" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="checkNumber">Check #</Label>
                  <Input id="checkNumber" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkDate">Check Date</Label>
                  <Input id="checkDate" type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="bankAccount">Bank Account</Label>
              <Input id="bankAccount" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Bank account ref" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wtRate">Withholding Tax Rate (%)</Label>
              <Input id="wtRate" type="number" step="0.01" value={withholdingTaxRate} onChange={e => setWithholdingTaxRate(e.target.value)} placeholder="e.g. 1 for 1%" />
              {wtRate > 0 && (
                <p className="text-xs text-muted-foreground">
                  WT Amount: {wtAmount.toFixed(2)} | Net: {netAmount.toFixed(2)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Disbursement"}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
