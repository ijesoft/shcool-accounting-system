"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface FormData {
  code: string
  name: string
  tin: string
  address: string
  fiscalYearStart: string
}

const defaultForm: FormData = {
  code: "",
  name: "",
  tin: "",
  address: "",
  fiscalYearStart: new Date().getFullYear() + "-01-01",
}

export function CreateEntityDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = useCallback(async () => {
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/v1/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message || "Failed to create entity")
        return
      }
      setForm(defaultForm)
      setOpen(false)
      router.refresh()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }, [form, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Branch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Branch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              placeholder="e.g. MAIN, CEBU, DAVAO"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Branch Name</Label>
            <Input
              id="name"
              placeholder="e.g. Main Campus"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tin">TIN (optional)</Label>
            <Input
              id="tin"
              placeholder="000-000-000-000"
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              placeholder="123 Education St"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiscalYearStart">
              Fiscal Year Start <span className="text-muted-foreground">(YYYY-MM-DD)</span>
            </Label>
            <Input
              id="fiscalYearStart"
              placeholder="2026-01-01"
              value={form.fiscalYearStart}
              onChange={(e) => setForm({ ...form, fiscalYearStart: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? "Creating..." : "Create Branch"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function EditEntityDialog({
  entity,
  open,
  onOpenChange,
}: {
  entity: { id: string; name: string; tin?: string | null; address?: string | null; status: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({ name: entity.name, tin: entity.tin || "", address: entity.address || "" })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = useCallback(async () => {
    setError("")
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/entities/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message || "Failed to update entity")
        return
      }
      onOpenChange(false)
      router.refresh()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }, [form, entity.id, onOpenChange, router])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Branch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Branch Name</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tin">TIN</Label>
            <Input
              id="edit-tin"
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-address">Address</Label>
            <Input
              id="edit-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
