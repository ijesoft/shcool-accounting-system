"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { formatAmount } from "@/lib/utils"

interface Student {
  id: string
  student_number: string
  full_name: string
}

interface InvoiceOption {
  id: string
  invoice_number: string
  balance: number
  total_amount: number
  status: string
}

export default function NewCashReceiptPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [studentId, setStudentId] = useState("")
  const [invoices, setInvoices] = useState<InvoiceOption[]>([])
  const [invoiceId, setInvoiceId] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [paymentType, setPaymentType] = useState<"tuition" | "enrollment_deposit">("tuition")
  const [checkNumber, setCheckNumber] = useState("")
  const [checkDate, setCheckDate] = useState("")
  const [bankName, setBankName] = useState("")
  const [reference, setReference] = useState("")
  const [payorName, setPayorName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/v1/student-accounts")
      .then(r => r.json())
      .then(d => setStudents(d.data?.rows ?? d.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!studentId) { setInvoices([]); setInvoiceId(""); return }
    fetch(`/api/v1/student-accounts/${studentId}/invoices`)
      .then(r => r.json())
      .then(d => {
        const rows = (d.data?.rows ?? d.data ?? []) as InvoiceOption[]
        const open = rows.filter(i => Number(i.balance) > 0)
        setInvoices(open)
        setInvoiceId("")
      })
      .catch(() => { setInvoices([]); setInvoiceId("") })
  }, [studentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/v1/cash-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId || undefined,
          invoiceId: invoiceId || undefined,
          paymentDate,
          amount: parseFloat(amount),
          paymentMethod,
          paymentType,
          checkNumber: checkNumber || undefined,
          checkDate: checkDate || undefined,
          bankName: bankName || undefined,
          reference: reference || undefined,
          payorName: payorName || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || "Failed") }
      const created = await res.json()
      const receiptId = created?.data?.id
      if (receiptId) {
        const postRes = await fetch(`/api/v1/cash-receipts/${receiptId}/post`, { method: "POST" })
        if (!postRes.ok) {
          const d = await postRes.json().catch(() => ({}))
          setError(`Receipt saved, but journal posting failed: ${d.error?.message || "Unknown error"}. You can retry posting from the list.`)
          router.push("/cash-receipts")
          router.refresh()
          return
        }
      }
      router.push("/cash-receipts")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">New Cash Receipt</h1>
      <Card>
        <CardHeader><CardTitle>Receipt Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student">Student (optional)</Label>
              <select id="student" value={studentId} onChange={e => setStudentId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">— Walk-in / No student —</option>
                {students.map((s: any) => <option key={s.id} value={s.id}>{s.student_number} - {s.full_name}</option>)}
              </select>
            </div>
            {studentId && (
              <div className="space-y-2">
                <Label htmlFor="invoice">Apply to invoice (optional)</Label>
                <select id="invoice" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">— No invoice / On account —</option>
                  {invoices.map((i: any) => (
                    <option key={i.id} value={i.id}>
                      {i.invoice_number} — balance {formatAmount(Number(i.balance))}
                    </option>
                  ))}
                </select>
                {invoices.length === 0 && (
                  <p className="text-xs text-muted-foreground">No open invoices for this student.</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="payorName">Payor Name</Label>
              <Input id="payorName" value={payorName} onChange={e => setPayorName(e.target.value)} placeholder="Payor name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input id="paymentDate" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentType">Payment Type</Label>
              <select
                id="paymentType"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as "tuition" | "enrollment_deposit")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="tuition">Tuition / Fee Payment</option>
                <option value="enrollment_deposit">Enrollment Deposit</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="online">Online Payment</option>
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
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input id="bankName" value={bankName} onChange={e => setBankName(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" value={reference} onChange={e => setReference(e.target.value)} placeholder="OR/ref #" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Receipt"}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
