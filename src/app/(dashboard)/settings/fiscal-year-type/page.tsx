"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

function getFiscalLabel(type: "calendar" | "school_year", startMonth: number): string {
  const year = new Date().getFullYear()
  if (type === "calendar") {
    return `FY ${year} (January 1 – December 31, ${year})`
  }
  const endYear = year + 1
  return `SY ${year}-${endYear} (${MONTHS[startMonth - 1]} 1, ${year} – ${MONTHS[(startMonth + 10) % 12]} 30, ${endYear})`
}

export default function FiscalYearTypePage() {
  const [fiscalYearType, setFiscalYearType] = useState<"calendar" | "school_year">("calendar")
  const [startMonth, setStartMonth] = useState(6)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/entities/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json?.data?.fiscalYearType) setFiscalYearType(json.data.fiscalYearType)
        if (json?.data?.schoolYearStartMonth) setStartMonth(json.data.schoolYearStartMonth)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/v1/entities/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYearType, schoolYearStartMonth: startMonth }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? "Failed to save")
      setMessage("Settings saved successfully.")
    } catch (e: any) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-6 text-muted-foreground">Loading...</p>

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-3xl font-bold">Fiscal Year Type</h1>
      <p className="text-muted-foreground">
        Choose whether your fiscal year follows the calendar year (January–December) or the school year (e.g., June–May for DepEd).
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Fiscal Period Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="fiscalYearType"
                value="calendar"
                checked={fiscalYearType === "calendar"}
                onChange={() => setFiscalYearType("calendar")}
                className="h-4 w-4"
              />
              <div>
                <p className="font-medium">Calendar Year</p>
                <p className="text-sm text-muted-foreground">January 1 to December 31</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="fiscalYearType"
                value="school_year"
                checked={fiscalYearType === "school_year"}
                onChange={() => setFiscalYearType("school_year")}
                className="h-4 w-4"
              />
              <div>
                <p className="font-medium">School Year</p>
                <p className="text-sm text-muted-foreground">Fiscal period starts in the chosen month (DepEd default: June)</p>
              </div>
            </label>
          </div>

          {fiscalYearType === "school_year" && (
            <div>
              <label className="block text-sm font-medium mb-1">School Year Start Month</label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className="rounded-md border px-3 py-2 text-sm w-full"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <span className="font-medium">Current fiscal period label:</span>{" "}
            {getFiscalLabel(fiscalYearType, startMonth)}
          </div>

          {message && (
            <p className={`text-sm ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </p>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
