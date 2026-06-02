# Add Student Dialog — Spec

## Context

The student-accounts page (`/student-accounts`) lists students with search/pagination but has no way to add new students. The backend already supports creation via `POST /api/v1/student-accounts` and `studentAccountService.create()`. This spec adds the frontend UI to create students.

## Requirements

- Add a "Add Student" button on the student-accounts page
- Button triggers a Dialog modal with a form
- Form includes: Student Number (auto-generated, editable), Full Name (required), Status (default: enrolled)
- On success: student is created, dialog closes, page revalidates
- On error: inline validation errors or toast notification
- RBAC: button only visible if user has `student_accounts.create` permission

## Design

### UI Pattern

Dialog modal, matching the existing `AddAccountDialog` pattern in `src/app/(dashboard)/accounts/add-account.tsx`.

### Components

#### 1. `CreateStudentDialog` (Client Component)

- **File:** `src/app/(dashboard)/student-accounts/create-student-dialog.tsx`
- **Type:** `'use client'` component
- **Props:** none (gets entity context from Server Action)
- **Behavior:**
  - Renders a Dialog with "Add Student" trigger button
  - On open, fetches next student number from API
  - Form fields:
    - `studentNumber` — text input, pre-filled, required, unique validation
    - `fullName` — text input, required, max 200 chars
    - `status` — select, default "enrolled", options: enrolled/graduated/transferred/withdrawn
  - On submit, calls `createStudent` Server Action
  - On success, closes dialog, revalidates page
  - On error, shows inline errors

#### 2. `createStudent` Server Action

- **File:** `src/app/(dashboard)/student-accounts/actions.ts`
- **Type:** `'use server'` function
- **Signature:** `async function createStudent(data: CreateStudentInput): Promise<{ success: boolean; error?: string }>`
- **Zod Schema:**
  ```ts
  const createStudentSchema = z.object({
    studentNumber: z.string().min(1).max(30),
    fullName: z.string().min(1).max(200),
    status: z.enum(["enrolled", "graduated", "transferred", "withdrawn"]).default("enrolled"),
  })
  ```
- **Flow:**
  1. Validate input with Zod
  2. Get session via `getSession()`
  3. Get entity schema via `prisma.entity.findUnique()`
  4. Call `studentAccountService.create(entitySchema, data)`
  5. On success, `revalidatePath('/student-accounts')`
  6. Return `{ success: true }` or `{ success: false, error: "..." }`

#### 3. Page Integration

- **File:** `src/app/(dashboard)/student-accounts/page.tsx`
- **Changes:**
  - Import `CreateStudentDialog`
  - Add button next to page title, wrapped in `hasPermission(session.roleName, "student_accounts", "create")` check
  - Layout: `<div className="flex items-center justify-between"><h1>Student Accounts</h1><CreateStudentDialog /></div>`

#### 4. Next Student Number API

- **File:** `src/app/api/v1/student-accounts/next-number/route.ts`
- **Type:** GET endpoint
- **Behavior:** Returns next student number based on max existing number + 1
- **Format:** `2026-0001` (year-sequence, zero-padded)

### Data Flow

```
User clicks "Add Student"
  → Dialog opens
  → Fetches next student number from /api/v1/student-accounts/next-number
  → User fills form (can edit number)
  → Submits form
  → createStudent Server Action validates and creates student
  → Page revalidates
  → Dialog closes
  → New student appears in list
```

### Error Handling

- **Duplicate student number:** Inline error on the `studentNumber` field
- **Validation errors:** Inline field errors (Zod validation)
- **Network/DB errors:** Toast notification with error message
- **Unauthorized:** Button not shown (RBAC check)

### RBAC

- Button visible only if `hasPermission(session.roleName, "student_accounts", "create")` is true
- Server Action also checks session and permissions

### Testing

- Unit test for `createStudent` Server Action with valid/invalid inputs
- Test duplicate student number handling
- Test RBAC — button hidden for unauthorized users

## Dependencies

- `studentAccountService.create()` — already exists
- `getSession()` — already exists
- `hasPermission()` — already exists
- Dialog, Button, Input, Select — shadcn/ui components already available

## Out of Scope

- Bulk import students
- Student photo/avatar
- Contact info fields (can be added later)
- Course/grade level fields (can be added later)
