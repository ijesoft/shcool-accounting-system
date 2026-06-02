"use client"

import { useState, useTransition, useEffect } from "react"
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

const studentStatuses = [
  { value: "enrolled", label: "Enrolled" },
  { value: "graduated", label: "Graduated" },
  { value: "transferred", label: "Transferred" },
  { value: "withdrawn", label: "Withdrawn" },
]

type FormState = {
  studentNumber: string
  fullName: string
  course: string
  gradeLevel: string
  status: string
}

const initialState: FormState = {
  studentNumber: "",
  fullName: "",
  course: "",
  gradeLevel: "",
  status: "enrolled",
}

export function CreateStudentDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [loadingNumber, setLoadingNumber] = useState(false)
  const [formData, setFormData] = useState<FormState>(initialState)

  useEffect(() => {
    if (open && !formData.studentNumber) {
      setLoadingNumber(true)
      fetch("/api/v1/student-accounts/next-number")
        .then((res) => res.json())
        .then((data) => {
          if (data?.data?.studentNumber) {
            setFormData((prev) => ({ ...prev, studentNumber: data.data.studentNumber }))
          }
        })
        .catch(() => {})
        .finally(() => setLoadingNumber(false))
    }
  }, [open, formData.studentNumber])

  const resetAndClose = () => {
    setOpen(false)
    setError("")
    setFormData(initialState)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    startTransition(async () => {
      try {
        const payload: Record<string, unknown> = {
          studentNumber: formData.studentNumber.trim(),
          fullName: formData.fullName.trim(),
          status: formData.status,
        }
        if (formData.course.trim()) payload.course = formData.course.trim()
        if (formData.gradeLevel.trim()) payload.gradeLevel = formData.gradeLevel.trim()

        const res = await fetch("/api/v1/student-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error?.message || "Failed to create student")
          return
        }
        router.refresh()
        resetAndClose()
      } catch {
        setError("Failed to create student")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentNumber">Student Number</Label>
              <Input
                id="studentNumber"
                value={formData.studentNumber}
                onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })}
                placeholder="e.g. 2026-0001"
                required
                disabled={loadingNumber}
              />
              {loadingNumber && (
                <p className="text-xs text-muted-foreground">Generating next number…</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Juan Dela Cruz"
                required
                maxLength={200}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="course">
                Course <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="course"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                placeholder="e.g. BSCS"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gradeLevel">
                Grade Level <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="gradeLevel"
                value={formData.gradeLevel}
                onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                placeholder="e.g. Grade 11, 1st Year"
                maxLength={50}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {studentStatuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              disabled={isPending}
            >
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
                  Create Student
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
