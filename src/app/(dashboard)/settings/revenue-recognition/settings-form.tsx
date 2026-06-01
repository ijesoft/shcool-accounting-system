"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function RevenueRecognitionSettings({
  entityId,
  initialMethod,
}: {
  entityId: string
  initialMethod: "term_straight_line" | "immediate"
}) {
  const [method, setMethod] = useState(initialMethod)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch(`/api/v1/entities/${entityId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueRecognitionMethod: method }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || "Save failed")
      setMessage("Settings saved.")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Recognition</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="method">Tuition recognition method</Label>
          <select
            id="method"
            value={method}
            onChange={(e) => setMethod(e.target.value as "term_straight_line" | "immediate")}
            className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="term_straight_line">Deferred (Unearned Tuition → recognize over term)</option>
            <option value="immediate">Immediate (recognize on billing)</option>
          </select>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  )
}
