"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const assetCategories = [
  "building", "equipment", "furniture", "vehicle", "computer", "land", "other"
]

export default function NewFixedAssetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/v1/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetCode: form.get("assetCode"),
          assetName: form.get("assetName"),
          assetCategory: form.get("assetCategory"),
          acquisitionDate: form.get("acquisitionDate"),
          acquisitionCost: Number(form.get("acquisitionCost")),
          estimatedLifeYears: Number(form.get("estimatedLifeYears")),
          salvageValue: Number(form.get("salvageValue")) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || "Failed to create asset")
      }
      router.push("/dashboard/fixed-assets")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Capitalize Asset</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="assetCode">Asset Code</Label>
          <Input id="assetCode" name="assetCode" required placeholder="e.g. BLDG-001" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assetName">Asset Name</Label>
          <Input id="assetName" name="assetName" required placeholder="e.g. Main Building" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assetCategory">Category</Label>
          <select id="assetCategory" name="assetCategory" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
            {assetCategories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="acquisitionDate">Acquisition Date</Label>
          <Input id="acquisitionDate" name="acquisitionDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acquisitionCost">Acquisition Cost (PHP)</Label>
          <Input id="acquisitionCost" name="acquisitionCost" type="number" step="0.01" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedLifeYears">Estimated Life (Years)</Label>
          <Input id="estimatedLifeYears" name="estimatedLifeYears" type="number" min="1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salvageValue">Salvage Value (PHP)</Label>
          <Input id="salvageValue" name="salvageValue" type="number" step="0.01" defaultValue="0" />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Capitalize Asset"}
        </Button>
      </form>
    </div>
  )
}
