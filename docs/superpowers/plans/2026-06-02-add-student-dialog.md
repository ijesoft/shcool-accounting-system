# Add Student Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a functional "Add Student" button on the student-accounts page that opens a Dialog modal to create new students.

**Architecture:** Dialog modal with form, POST to existing `/api/v1/student-accounts` endpoint, `router.refresh()` to revalidate. Follows the `AddAccountDialog` pattern exactly.

**Tech Stack:** Next.js 16 App Router, React 19, shadcn/ui Dialog, Prisma $queryRawUnsafe, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/(dashboard)/student-accounts/create-student-dialog.tsx` | Dialog + form component |
| Create | `src/app/api/v1/student-accounts/next-number/route.ts` | Auto-generate next student number |
| Modify | `src/app/(dashboard)/student-accounts/page.tsx:32-34` | Add button next to title |
| Modify | `src/__tests__/e2e/routes.e2e.test.ts` | Add tests for next-number endpoint |

---

### Task 1: Next Student Number API Endpoint

**Files:**
- Create: `src/app/api/v1/student-accounts/next-number/route.ts`

- [ ] **Step 1: Write the test**

Add to `src/__tests__/e2e/routes.e2e.test.ts`:

```ts
describe("Student Accounts - Next Number", () => {
  it("should return next student number", async () => {
    const res = await fetch("http://localhost:3000/api/v1/student-accounts/next-number")
    const data = await res.json()
    expect(res.ok).toBe(true)
    expect(data.data.studentNumber).toMatch(/\d{4}-\d{4}/)
  })
})
```

- [ ] **Step 2: Create the route file**

Create `src/app/api/v1/student-accounts/next-number/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "student_accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
    if (!entity) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const year = new Date().getFullYear()
    const rows = await prisma.$queryRawUnsafe<{ next: number }[]>(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(student_number, '-', 2) AS INT)), 0) + 1 as next
       FROM "${entity.schemaName}".student
       WHERE student_number LIKE $1`,
      `${year}-%`
    )
    const nextNum = rows[0]?.next ?? 1
    const studentNumber = `${year}-${String(nextNum).padStart(4, "0")}`

    return NextResponse.json(formatApiResponse({ studentNumber }))
  } catch (error) {
    console.error("Next number error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get next number"), { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/student-accounts/next-number/route.ts
git commit -m "feat: add next student number API endpoint"
```

---

### Task 2: Create Student Dialog Component

**Files:**
- Create: `src/app/(dashboard)/student-accounts/create-student-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `src/app/(dashboard)/student-accounts/create-student-dialog.tsx`:

```tsx
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

export function CreateStudentDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [loadingNumber, setLoadingNumber] = useState(false)

  const [formData, setFormData] = useState({
    studentNumber: "",
    fullName: "",
    status: "enrolled",
  })

  useEffect(() => {
    if (open && !formData.studentNumber) {
      setLoadingNumber(true)
      fetch("/api/v1/student-accounts/next-number")
        .then((res) => res.json())
        .then((data) => {
          if (data.data?.studentNumber) {
            setFormData((prev) => ({ ...prev, studentNumber: data.data.studentNumber }))
          }
        })
        .catch(() => {})
        .finally(() => setLoadingNumber(false))
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/student-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentNumber: formData.studentNumber,
            fullName: formData.fullName,
            status: formData.status,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error?.message || "Failed to create student")
          return
        }
        router.refresh()
        setOpen(false)
        setFormData({ studentNumber: "", fullName: "", status: "enrolled" })
      } catch {
        setError("Failed to create student")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setError("") }} disabled={isPending}>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/student-accounts/create-student-dialog.tsx
git commit -m "feat: add CreateStudentDialog component"
```

---

### Task 3: Integrate Dialog into Student Accounts Page

**Files:**
- Modify: `src/app/(dashboard)/student-accounts/page.tsx:32-34`

- [ ] **Step 1: Modify the page**

In `src/app/(dashboard)/student-accounts/page.tsx`:

Change the import section to add `CreateStudentDialog`:

```tsx
import { studentAccountService } from "@/services/student-account.service"
import { prisma } from "@/lib/db"
import { SearchPagination } from "@/components/ui/search-pagination"
import { CreateStudentDialog } from "./create-student-dialog"
```

Change the JSX from:

```tsx
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Student Accounts</h1>
```

To:

```tsx
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Student Accounts</h1>
        {hasPermission(session.roleName, "student_accounts", "create") && (
          <CreateStudentDialog />
        )}
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/student-accounts/page.tsx
git commit -m "feat: integrate Add Student button on student-accounts page"
```

---

### Task 4: Add Tests for Next Number Endpoint

**Files:**
- Modify: `src/__tests__/e2e/routes.e2e.test.ts`

- [ ] **Step 1: Add test**

Add to `src/__tests__/e2e/routes.e2e.test.ts` in the appropriate describe block:

```ts
describe("Student Accounts - Next Number", () => {
  it("should return next student number in correct format", async () => {
    const res = await fetch("http://localhost:3000/api/v1/student-accounts/next-number")
    const data = await res.json()
    expect(res.ok).toBe(true)
    expect(data.data.studentNumber).toMatch(/\d{4}-\d{4}/)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- routes.e2e.test.ts --run
```

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/e2e/routes.e2e.test.ts
git commit -m "test: add next student number endpoint test"
```

---

### Task 5: Verification

- [ ] **Step 1: Run dev server and manual test**

```bash
npm run dev
```

Navigate to `http://localhost:3000/student-accounts` and verify:
1. "Add Student" button appears (if user has `student_accounts.create` permission)
2. Clicking opens a Dialog with form
3. Student number is auto-generated (format: `2026-0001`)
4. Form validates required fields
5. Submitting creates a new student
6. Page refreshes with new student in list
7. Duplicate student number shows error

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Add Student dialog feature"
```
