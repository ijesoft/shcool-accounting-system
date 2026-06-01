"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RunRecognitionButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleRun() {
    if (!periodStart || !periodEnd) {
      setMessage("Period start and end are required")
      return
    }
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/v1/revenue-recognition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || "Recognition failed")
      setMessage(data.data.message)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Recognition failed")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button onClick={() => setOpen(true)}>Run Revenue Recognition</Button>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 min-w-[280px]">
      <p className="text-sm font-medium">Recognize revenue for period</p>
      <div className="space-y-2">
        <Label htmlFor="periodStart">Period Start</Label>
        <Input id="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="periodEnd">Period End</Label>
        <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={loading} onClick={handleRun}>
          {loading ? "Running..." : "Run"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {message && <p className="text-xs text-red-600">{message}</p>}
    </div>
  )
}
