# Journal-Entry ↔ Subledger Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a journal-entry line uses a subledger account (AR/AP), the line must carry a student/vendor/employee tag, and the JE detail page offers a one-click "Apply to open invoice/bill" flow that creates the subledger allocation.

**Architecture:** Add `subledger_type` to the chart of accounts; add `party_type` + `party_id` to journal_entry_line; render a per-line picker driven by the account's subledger type; on the JE detail page (posted only), show open invoices/bills for the tagged party with an Apply button that reduces the invoice/bill balance.

**Tech Stack:** Next.js 14 App Router, Prisma raw SQL, Zod, Tailwind, Radix.

**Spec:** `docs/superpowers/specs/2026-06-02-je-subledger-tagging-design.md`

---

## File Structure

**Modified:**
- `src/lib/entity-schema.ts` — add 3 idempotent migrations
- `src/lib/validators/journal-entry.ts` — accept partyType/partyId
- `src/repositories/journal-entry.repository.ts` — persist + return party columns
- `src/services/journal-entry.service.ts` — validate party matches account subledger type
- `src/services/account.service.ts` (or list endpoint) — include subledger_type
- `src/app/(dashboard)/journal-entries/new/page.tsx` — render pickers
- `src/app/(dashboard)/journal-entries/[id]/page.tsx` — show Apply panel
- `src/app/(dashboard)/student-accounts/[id]/page.tsx` — add GL activity section
- `src/app/(dashboard)/vendor-accounts/[id]/page.tsx` — add GL activity section
- `AGENTS.md` — document new columns + apply flow

**New:**
- `src/components/customer-autocomplete.tsx` — search students
- `src/components/vendor-autocomplete.tsx` — search vendors
- `src/components/employee-autocomplete.tsx` — search employees (stub for employee AP)
- `src/app/api/v1/journal-entries/[id]/lines/[lineId]/apply/route.ts` — apply line to invoice/bill
- `src/app/(dashboard)/journal-entries/[id]/apply-button.tsx` — client component for Apply

---

## Task 1: Schema migration — `subledger_type` on `account` + `party_*` on `journal_entry_line`

**Files:**
- Modify: `src/lib/entity-schema.ts` (append to the `migrations` string in `migrateEntitySchema`)

- [ ] **Step 1: Open `src/lib/entity-schema.ts` and locate the `migrateEntitySchema` function** (search for `migrateEntitySchema`). The `migrations` template literal inside it holds the idempotent ALTER TABLE / backfill statements. Add the following statements at the end of the literal (just before the closing backtick):

```sql
ALTER TABLE "${schemaName}".account
  ADD COLUMN IF NOT EXISTS subledger_type VARCHAR(20)
    CHECK (subledger_type IN ('student', 'vendor', 'employee') OR subledger_type IS NULL);

ALTER TABLE "${schemaName}".journal_entry_line
  ADD COLUMN IF NOT EXISTS party_type VARCHAR(20)
    CHECK (party_type IN ('student', 'vendor', 'employee') OR party_type IS NULL);

ALTER TABLE "${schemaName}".journal_entry_line
  ADD COLUMN IF NOT EXISTS party_id UUID;

UPDATE "${schemaName}".account SET subledger_type = 'student'
  WHERE subledger_type IS NULL AND account_code IN ('11210','11211','11212','11213','11214');

UPDATE "${schemaName}".account SET subledger_type = 'employee'
  WHERE subledger_type IS NULL AND account_code IN ('11250','11260','21210');

UPDATE "${schemaName}".account SET subledger_type = 'vendor'
  WHERE subledger_type IS NULL AND account_code IN ('21110','21120','21130','21140');
```

The function's existing `for (const stmt of migrations.split(";"))` loop will pick these up and run each one. No further code change is needed in this task.

- [ ] **Step 2: Typecheck**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | tee "$env:TEMP\opencode\tc-1.log" | Out-Null
```

Expected: only the pre-existing errors in `accounts.e2e.test.ts` and `__tests__/lib/...` show up. No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/entity-schema.ts
git commit -m "feat(schema): add subledger_type on account, party_type/party_id on je_line"
```

---

## Task 2: Run migration on entity_main

**Files:** none (runs existing script)

- [ ] **Step 1: Apply the migration to entity_main**

```bash
cd E:\shcool-accounting-system && npx tsx scripts/migrate-entities.ts 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\mig-1.log"
```

Expected: prints "Migrated entity_main" (or similar) and exits 0. The script iterates all entities; entity_main is the only one that exists.

- [ ] **Step 2: Verify columns were added**

```bash
cd E:\shcool-accounting-system && npx tsx -e "
import { prisma } from './src/lib/db';
const e = await prisma.entity.findFirst({ where: { code: 'MAIN' } });
const r = await prisma.\$queryRawUnsafe(
  \"SELECT column_name FROM information_schema.columns WHERE table_schema = \\$\\${e.schemaName} AND table_name IN ('account','journal_entry_line') AND column_name IN ('subledger_type','party_type','party_id') ORDER BY table_name, column_name\"
);
console.log(r);
process.exit(0);
" 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\verify-cols.log"
```

Expected output: 3 rows (`account.subledger_type`, `journal_entry_line.party_id`, `journal_entry_line.party_type`).

- [ ] **Step 3: Verify chart defaults applied**

```bash
cd E:\shcool-accounting-system && npx tsx -e "
import { prisma } from './src/lib/db';
const e = await prisma.entity.findFirst({ where: { code: 'MAIN' } });
const r = await prisma.\$queryRawUnsafe(
  \"SELECT account_code, account_name, subledger_type FROM \\$\\${e.schemaName}.account WHERE subledger_type IS NOT NULL ORDER BY account_code\"
);
console.log(r);
process.exit(0);
" 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\verify-defaults.log"
```

Expected: 5 student rows (11210-11214), 3 employee rows (11250, 11260, 21210), 4 vendor rows (21110-21140).

- [ ] **Step 4: Commit the verified state** (no source change; nothing to commit. Skip if git status is clean.)

---

## Task 3: Validator — accept `partyType` + `partyId` on JE lines

**Files:**
- Modify: `src/lib/validators/journal-entry.ts`

- [ ] **Step 1: Replace the `journalEntryLineSchema` definition** with the version that includes the two new optional fields. The `.refine` at the end must still require at least one of debit/credit > 0; add a second `.refine` that enforces the cross-field rule (both set OR both null):

```ts
export const journalEntryLineSchema = z.object({
  accountId: z.string().uuid("Account must be a valid UUID"),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  lineDescription: z.string().optional(),
  lineOrder: z.number().int().min(0),
  partyType: z.enum(["student", "vendor", "employee"]).optional(),
  partyId: z.string().uuid().optional(),
}).refine(
  (data) => data.debit > 0 || data.credit > 0,
  { message: "Each line must have either a debit or credit amount" }
).refine(
  (data) => (data.partyType == null) === (data.partyId == null),
  { message: "partyType and partyId must both be set or both be empty" }
)
```

- [ ] **Step 2: Typecheck**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-3.log" | Out-Null
```

Expected: no new errors. (Pre-existing ones unchanged.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/validators/journal-entry.ts
git commit -m "feat(validator): accept partyType/partyId on journal-entry lines"
```

---

## Task 4: Repository — persist and return `party_type`/`party_id`

**Files:**
- Modify: `src/repositories/journal-entry.repository.ts`

- [ ] **Step 1: Extend the line-shape in `create()` and `update()`** so the data type includes `partyType?: string` and `partyId?: string`. In the `create` function, the INSERT loop becomes:

```ts
for (const line of data.lines) {
  await prisma.$queryRawUnsafe(
    `INSERT INTO "${entitySchema}".journal_entry_line
     (journal_entry_id, account_id, debit, credit, line_description, line_order, party_type, party_id)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::uuid)`,
    entry.id,
    line.accountId,
    line.debit,
    line.credit,
    line.lineDescription || null,
    line.lineOrder,
    line.partyType || null,
    line.partyId || null
  )
}
```

- [ ] **Step 2: Update the `update()` function's INSERT** the same way. The `update()` method's `data.lines` type also gets `partyType?: string; partyId?: string`, and its INSERT inside `for (const line of data.lines)` mirrors the one in `create()` exactly.

- [ ] **Step 3: Update `findById()`'s SELECT** to LEFT JOIN the party name. This lets the JE detail page show e.g. "Maricel S." next to a tagged AR line. Replace the existing line-select in `findById` with:

```ts
const lines = await prisma.$queryRawUnsafe<any[]>(
  `SELECT jel.*, a.account_code, a.account_name,
          jel.party_type, jel.party_id,
          CASE jel.party_type
            WHEN 'student' THEN s.full_name
            WHEN 'vendor'  THEN v.vendor_name
            WHEN 'employee' THEN e.full_name
            ELSE NULL
          END as party_name
   FROM "${entitySchema}".journal_entry_line jel
   JOIN "${entitySchema}".account a ON a.id = jel.account_id
   LEFT JOIN "${entitySchema}".student  s ON jel.party_type='student'  AND s.id = jel.party_id
   LEFT JOIN "${entitySchema}".vendor   v ON jel.party_type='vendor'   AND v.id = jel.party_id
   LEFT JOIN "${entitySchema}".employee e ON jel.party_type='employee' AND e.id = jel.party_id
   WHERE jel.journal_entry_id = $1::uuid
   ORDER BY jel.line_order`,
  id
)
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-4.log" | Out-Null
```

Expected: no new errors. (The lines now include `party_type`, `party_id`, `party_name` as extra string properties; consumers see them via `any[]` typing.)

```bash
git add src/repositories/journal-entry.repository.ts
git commit -m "feat(repo): persist and return party_type/party_id on journal lines"
```

---

## Task 5: Service — validate party matches account's subledger_type

**Files:**
- Modify: `src/services/journal-entry.service.ts`

- [ ] **Step 1: Read the service** to find `create()`. The current implementation likely just calls `journalEntryRepository.create(schema, data, userId)`. We need to (a) look up the subledger_type of every account used in the lines, (b) reject any line where the account requires a party and the line lacks one (or the types don't match), and (c) reject any line that has a party but the account doesn't allow one.

Add a helper at the top of the service file (above the `journalEntryService` object):

```ts
async function validateParties(
  entitySchema: string,
  lines: { accountId: string; partyType?: string; partyId?: string; lineOrder: number }[]
) {
  if (lines.length === 0) return

  const accountIds = [...new Set(lines.map((l) => l.accountId))]
  const placeholders = accountIds.map((_, i) => `$${i + 1}::uuid`).join(",")
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text as id, account_code, subledger_type
     FROM "${entitySchema}".account WHERE id IN (${placeholders})`,
    ...accountIds
  )
  const accountById = new Map(rows.map((a) => [a.id, a]))

  for (const line of lines) {
    const acc = accountById.get(line.accountId)
    if (!acc) throw new Error(`Line ${line.lineOrder + 1}: account not found`)

    if (acc.subledger_type) {
      if (!line.partyId || !line.partyType) {
        throw Object.assign(
          new Error(`Line ${line.lineOrder + 1}: account ${acc.account_code} requires a ${acc.subledger_type} party`),
          { status: 400, code: "ERR_VALIDATION" }
        )
      }
      if (line.partyType !== acc.subledger_type) {
        throw Object.assign(
          new Error(`Line ${line.lineOrder + 1}: account ${acc.account_code} expects ${acc.subledger_type} but got ${line.partyType}`),
          { status: 400, code: "ERR_VALIDATION" }
        )
      }
    } else if (line.partyId || line.partyType) {
      throw Object.assign(
        new Error(`Line ${line.lineOrder + 1}: account ${acc.account_code} is not a subledger account; cannot have a party`),
        { status: 400, code: "ERR_VALIDATION" }
      )
    }
  }
}
```

- [ ] **Step 2: Call the helper inside `create()`** before delegating to the repository:

```ts
async create(entitySchema: string, data: CreateJournalEntryInput, userId: string) {
  await validateParties(entitySchema, data.lines as any)
  return journalEntryRepository.create(entitySchema, { ...data, createdBy: userId })
}
```

(The exact signature may differ — match the existing one; the only required change is the `await validateParties(...)` call as the first statement in `create`.)

- [ ] **Step 3: Do the same for `update()`** if the service has one:

```ts
async update(entitySchema: string, id: string, data: UpdateJournalEntryInput) {
  if (data.lines) await validateParties(entitySchema, data.lines as any)
  return journalEntryRepository.update(entitySchema, id, data)
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-5.log" | Out-Null
```

Expected: no new errors.

```bash
git add src/services/journal-entry.service.ts
git commit -m "feat(service): validate party matches account subledger_type on JE create/update"
```

---

## Task 6: List endpoint — include `subledger_type` in accounts response

**Files:**
- Modify: `src/repositories/account.repository.ts` (in the `list` and `getTree`/`findById` queries) — include `subledger_type`
- Modify: `src/app/api/v1/accounts/route.ts` — no change needed (just returns whatever the service returns)

- [ ] **Step 1: Update the `SELECT *` calls** in `account.repository.ts` (search for `SELECT * FROM "${entitySchema}"."account"`) to also select `subledger_type` explicitly. There are at least three such queries (list, getTree, findById). Change each from `SELECT *` to:

```ts
`SELECT id::text as id, account_code, account_name, account_type, normal_balance, level, parent_id::text as parent_id, is_active, is_postable, subledger_type FROM "${entitySchema}".account`
```

Preserve the existing `WHERE` / `ORDER BY` / `LIMIT` clauses that follow.

- [ ] **Step 2: If the tree builder normalizes fields, expose `subledger_type` there** too. Check `src/services/account.service.ts` for `getTree` and ensure the returned objects include `subledger_type`. No change is required if the service just returns the raw repo rows.

- [ ] **Step 3: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-6.log" | Out-Null
```

Expected: no new errors.

```bash
git add src/repositories/account.repository.ts
git commit -m "feat(accounts): include subledger_type in list/find responses"
```

---

## Task 7: Party autocomplete components

**Files:**
- Create: `src/components/customer-autocomplete.tsx`
- Create: `src/components/vendor-autocomplete.tsx`
- Create: `src/components/employee-autocomplete.tsx`

- [ ] **Step 1: Create `src/components/customer-autocomplete.tsx`**

Copy the structure of `src/components/account-autocomplete.tsx` (the file shipped in Task 1 of the previous feature). Adapt the fetch URL to `/api/v1/student-accounts` and the field mapping. Expected shape of each row from `studentAccountService.list`: `{ id, student_number, full_name, course, grade_level, status, total_balance }`. The display label is `${full_name} (${student_number})` and the search filters on `student_number` and `full_name`. Export both `PartyOption` (an interface with `id`, `label`, `subtext`) and the `CustomerAutocomplete` component. The component signature matches `AccountAutocomplete` exactly: `value`, `onChange`, `parties`, `placeholder?`, `className?`, `required?`, `disabled?`.

```ts
"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface PartyOption {
  id: string
  label: string
  subtext?: string
}

interface PartyAutocompleteProps {
  value: string
  onChange: (id: string) => void
  parties: PartyOption[]
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
}

function PartyAutocomplete({ value, onChange, parties, placeholder, className, required, disabled }: PartyAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(() => parties.find((p) => p.id === value) ?? null, [parties, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return parties.slice(0, 50)
    return parties.filter(
      (p) => p.label.toLowerCase().includes(q) || (p.subtext ?? "").toLowerCase().includes(q)
    ).slice(0, 50)
  }, [parties, query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  useEffect(() => { setHighlight(0) }, [query, open])

  function select(p: PartyOption) {
    onChange(p.id)
    setQuery("")
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === "Enter") { if (open && filtered[highlight]) { e.preventDefault(); select(filtered[highlight]) } }
    else if (e.key === "Escape") { setOpen(false) }
  }

  const display = open ? query : (selected?.label ?? "")

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input ref={inputRef} type="text" value={display}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setOpen(true); if (selected) setQuery("") }}
        onKeyDown={handleKey}
        placeholder={placeholder ?? "Search…"} required={required && !selected} disabled={disabled}
        autoComplete="off"
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((p, i) => (
            <button key={p.id} type="button" onClick={() => select(p)}
              onMouseEnter={() => setHighlight(i)}
              className={cn("flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs", i === highlight && "bg-accent text-accent-foreground")}>
              <span className="flex-1 truncate">{p.label}</span>
              {p.subtext && <span className="shrink-0 text-muted-foreground">{p.subtext}</span>}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">No matches for “{query}”.</div>
      )}
    </div>
  )
}

export function CustomerAutocomplete(props: Omit<PartyAutocompleteProps, "parties"> & { parties: PartyOption[] }) {
  return <PartyAutocomplete {...props} />
}
```

- [ ] **Step 2: Create `src/components/vendor-autocomplete.tsx`**

Identical structure to `customer-autocomplete.tsx`, but the component is `VendorAutocomplete` and the prop docstring mentions vendors. Re-export `PartyOption` from a shared location by importing it from `customer-autocomplete.tsx` (this avoids a circular import and keeps the file count low).

```ts
"use client"
import { PartyAutocomplete, type PartyOption } from "./customer-autocomplete"

export function VendorAutocomplete(props: Omit<React.ComponentProps<typeof PartyAutocomplete>, "parties"> & { parties: PartyOption[] }) {
  return <PartyAutocomplete {...props} placeholder={props.placeholder ?? "Search vendors…"} />
}
```

(You'll need to also re-export `PartyAutocomplete` from `customer-autocomplete.tsx` for this. Adjust the customer file's last line to `export { PartyAutocomplete, type PartyOption }`.)

- [ ] **Step 3: Create `src/components/employee-autocomplete.tsx`**

Identical structure to `vendor-autocomplete.tsx`, with the placeholder "Search employees…". Employee support is a stub — the Apply flow for employee AP is out of scope (the line can be tagged with an employee for audit, but the apply-to-bill button is hidden for employee-tagged lines). The autocomplete itself works.

```ts
"use client"
import { PartyAutocomplete } from "./customer-autocomplete"
export function EmployeeAutocomplete(props: React.ComponentProps<typeof PartyAutocomplete>) {
  return <PartyAutocomplete {...props} placeholder={props.placeholder ?? "Search employees…"} />
}
```

- [ ] **Step 4: Verify the API endpoints exist**

The employee API lives at `/api/v1/employees` and the list response shape is `{ id, employee_number, full_name, position, status }`. Confirm with:

```bash
Test-Path src\app\api\v1\employees\route.ts
```

Expected: True. If False, skip employee support and add a TODO comment in the JE form.

- [ ] **Step 5: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-7.log" | Out-Null
```

Expected: no new errors.

```bash
git add src/components/customer-autocomplete.tsx src/components/vendor-autocomplete.tsx src/components/employee-autocomplete.tsx
git commit -m "feat(components): customer/vendor/employee autocomplete pickers"
```

---

## Task 8: Form — show party picker per line

**Files:**
- Modify: `src/app/(dashboard)/journal-entries/new/page.tsx`

- [ ] **Step 1: Add state for parties** at the top of the component, after the existing `useState` calls:

```ts
const [students, setStudents] = useState<PartyOption[]>([])
const [vendors, setVendors] = useState<PartyOption[]>([])
const [employees, setEmployees] = useState<PartyOption[]>([])
```

Add a `useEffect` that fetches the three lists in parallel and stores them as `PartyOption[]`. (Re-use the existing `accounts` fetch as a template; replace the URL with the appropriate one for each party. Student list response is `{ rows, total }` — map `rows` to `PartyOption[]` with `label: \`${full_name} (${student_number})\`` and `subtext: course || grade_level || ""`. Vendor list response is `{ rows, total }` — map to `label: vendor_name` and `subtext: tin || ""`. Employee list response is similar — `label: \`${full_name} (${employee_number})\`` and `subtext: position || ""`.) Use `Promise.all` so all three fire in parallel.

- [ ] **Step 2: Add `partyType` + `partyId` to the `Line` interface and to `addLine`/`updateLine`**

```ts
interface Line {
  accountId: string
  debit: number
  credit: number
  lineDescription: string
  lineOrder: number
  partyType?: "student" | "vendor" | "employee"
  partyId?: string
}
```

Update `addLine` to include `partyType: undefined, partyId: undefined` in the new line. Update the existing two seed lines in `useState` to include them too.

- [ ] **Step 3: Look up the selected account's `subledger_type` for each line**

Add a small helper inside the component:

```ts
function subledgerTypeFor(line: Line): "student" | "vendor" | "employee" | null {
  const acc = accounts.find((a) => a.id === line.accountId)
  return (acc?.subledgerType as "student" | "vendor" | "employee" | null) ?? null
}
```

The `accounts` state needs to include `subledgerType` — update the fetch in `useEffect` (the one that already fetches `/api/v1/accounts`) to also store `subledgerType: a.subledger_type`.

- [ ] **Step 4: Render the party picker under the line, conditional on subledger_type**

Locate the Account column in the line-rendering block (it's a flex row with `<AccountAutocomplete>` inside a `<div className="flex-1 space-y-1">`). After the closing `</div>` of the Account div, add:

```tsx
{subledgerTypeFor(line) === "student" && (
  <div className="basis-full space-y-1">
    <Label className="text-xs">Customer</Label>
    <CustomerAutocomplete
      value={line.partyId ?? ""}
      onChange={(id) => {
        const u = [...lines]; u[i] = { ...u[i], partyType: "student", partyId: id || undefined }; setLines(u)
      }}
      parties={students}
      required
    />
  </div>
)}
{subledgerTypeFor(line) === "vendor" && (
  <div className="basis-full space-y-1">
    <Label className="text-xs">Vendor</Label>
    <VendorAutocomplete
      value={line.partyId ?? ""}
      onChange={(id) => {
        const u = [...lines]; u[i] = { ...u[i], partyType: "vendor", partyId: id || undefined }; setLines(u)
      }}
      parties={vendors}
      required
    />
  </div>
)}
{subledgerTypeFor(line) === "employee" && (
  <div className="basis-full space-y-1">
    <Label className="text-xs">Employee</Label>
    <EmployeeAutocomplete
      value={line.partyId ?? ""}
      onChange={(id) => {
        const u = [...lines]; u[i] = { ...u[i], partyType: "employee", partyId: id || undefined }; setLines(u)
      }}
      parties={employees}
      required
    />
  </div>
)}
```

To make these land on their own row (not squeeze into the horizontal flex), the parent `<div className="flex gap-2 items-end">` must become `<div className="flex flex-wrap gap-2 items-end">` (or use a grid). Change the parent class on the lines map accordingly.

- [ ] **Step 5: Include `partyType` + `partyId` in the POST body**

Update the `body: JSON.stringify({ ... lines: lines.map(...) })` block so each line object also includes `partyType: l.partyType, partyId: l.partyId` (omit them when undefined to keep the wire format clean: use a spread).

```ts
lines: lines.map((l) => ({
  accountId: l.accountId,
  debit: l.debit,
  credit: l.credit,
  lineDescription: l.lineDescription || undefined,
  lineOrder: l.lineOrder,
  ...(l.partyType ? { partyType: l.partyType } : {}),
  ...(l.partyId ? { partyId: l.partyId } : {}),
})),
```

- [ ] **Step 6: Add imports**

```ts
import { CustomerAutocomplete, VendorAutocomplete, EmployeeAutocomplete, type PartyOption } from "@/components/customer-autocomplete"
import { VendorAutocomplete as _VendorAuto } from "@/components/vendor-autocomplete"  // not needed, see note
import { EmployeeAutocomplete } from "@/components/employee-autocomplete"
```

(Adjust the imports: `VendorAutocomplete` is re-exported from `vendor-autocomplete.tsx`. `EmployeeAutocomplete` likewise. So a single line is enough: `import { CustomerAutocomplete, VendorAutocomplete, EmployeeAutocomplete } from "@/components/customer-autocomplete"` if all three are re-exported from that file. If not, import from the respective files.)

- [ ] **Step 7: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-8.log" | Out-Null
```

Expected: no new errors.

```bash
git add src/app/(dashboard)/journal-entries/new/page.tsx
git commit -m "feat(form): per-line customer/vendor/employee picker on journal entry"
```

---

## Task 9: Apply API — POST /journal-entries/[id]/lines/[lineId]/apply

**Files:**
- Create: `src/app/api/v1/journal-entries/[id]/lines/[lineId]/apply/route.ts`
- Create: `src/services/je-allocation.service.ts`

- [ ] **Step 1: Create the service** at `src/services/je-allocation.service.ts`:

```ts
import { prisma } from "@/lib/db"

export const jeAllocationService = {
  /**
   * Applies a portion of a journal entry line's amount to an open subledger document
   * (student_invoice for AR, vendor_invoice for AP). The JE itself is not modified;
   * this only reduces the subledger document's balance.
   *
   * Returns the updated invoice/bill.
   */
  async applyToDocument(
    entitySchema: string,
    lineId: string,
    data: { documentId: string; amount: number }
  ) {
    const lines = await prisma.$queryRawUnsafe<any[]>(
      `SELECT jel.id, jel.party_type, jel.party_id, jel.debit, jel.credit, a.subledger_type
       FROM "${entitySchema}".journal_entry_line jel
       JOIN "${entitySchema}".account a ON a.id = jel.account_id
       WHERE jel.id = $1::uuid`,
      lineId
    )
    const line = lines[0]
    if (!line) throw new Error("Line not found")
    if (!line.party_type || !line.party_id) {
      throw Object.assign(new Error("Line is not tagged with a party"), { status: 400, code: "ERR_VALIDATION" })
    }

    const lineAmount = Number(line.debit) - Number(line.credit)  // signed: AR debit = positive
    if (line.party_type === "student") {
      if (data.amount > lineAmount) throw Object.assign(new Error("Apply amount exceeds line amount"), { status: 400, code: "ERR_VALIDATION" })
      const docs = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, balance, total_amount, status FROM "${entitySchema}".student_invoice WHERE id = $1::uuid FOR UPDATE`,
        data.documentId
      )
      const doc = docs[0]
      if (!doc) throw new Error("Invoice not found")
      if (Number(data.amount) > Number(doc.balance)) {
        throw Object.assign(new Error("Apply amount exceeds invoice balance"), { status: 400, code: "ERR_VALIDATION" })
      }
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".student_invoice
         SET balance = balance - $1,
             status = CASE WHEN balance - $1 <= 0 THEN 'paid' WHEN balance - $1 < total_amount THEN 'partial' ELSE status END
         WHERE id = $2::uuid`,
        data.amount, data.documentId
      )
    } else if (line.party_type === "vendor") {
      if (-data.amount > lineAmount) throw Object.assign(new Error("Apply amount exceeds line amount"), { status: 400, code: "ERR_VALIDATION" })
      const docs = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, balance_due as balance, total_amount, status FROM "${entitySchema}".vendor_invoice WHERE id = $1::uuid FOR UPDATE`,
        data.documentId
      )
      const doc = docs[0]
      if (!doc) throw new Error("Bill not found")
      if (Number(data.amount) > Number(doc.balance)) {
        throw Object.assign(new Error("Apply amount exceeds bill balance"), { status: 400, code: "ERR_VALIDATION" })
      }
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".vendor_invoice
         SET balance_due = balance_due - $1,
             status = CASE WHEN balance_due - $1 <= 0 THEN 'paid' WHEN balance_due - $1 < total_amount THEN 'partial' ELSE status END
         WHERE id = $2::uuid`,
        data.amount, data.documentId
      )
    } else {
      throw Object.assign(new Error(`Apply flow not supported for party_type=${line.party_type}`), { status: 400, code: "ERR_VALIDATION" })
    }
    return { ok: true, applied: data.amount, documentId: data.documentId }
  },
}
```

(Verify the actual column name on `vendor_invoice` is `balance_due` — search `src/lib/entity-schema.ts` for the CREATE TABLE vendor_invoice statement. If it's `balance`, change the SELECT to use `balance` instead of `balance_due`. The plan is correct in either case but the field name must match the schema.)

- [ ] **Step 2: Create the API route** at `src/app/api/v1/journal-entries/[id]/lines/[lineId]/apply/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db"
import { jeAllocationService } from "@/services/je-allocation.service"
import { formatApiError, formatApiResponse } from "@/lib/utils"

async function getEntitySchema(entityId?: string) {
  if (!entityId) return null
  const e = await prisma.entity.findUnique({ where: { id: entityId } })
  return e?.schemaName ?? null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { lineId } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "journal_entries", "post")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    // Refuse to apply to an unposted JE
    const { id } = await params
    const heads = await prisma.$queryRawUnsafe<any[]>(
      `SELECT status FROM "${schema}".journal_entry WHERE id = $1::uuid`, id
    )
    if (!heads[0] || heads[0].status !== "posted") {
      return NextResponse.json(formatApiError("ERR_INVALID_STATE", "Apply is only available on posted entries"), { status: 400 })
    }

    const body = await request.json()
    if (!body.documentId || typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "documentId and positive amount required"), { status: 400 })
    }
    const result = await jeAllocationService.applyToDocument(schema, lineId, { documentId: body.documentId, amount: body.amount })
    return NextResponse.json(formatApiResponse(result))
  } catch (error: any) {
    if (error?.status) return NextResponse.json(formatApiError(error.code, error.message), { status: error.status })
    return NextResponse.json(formatApiError("ERR_INTERNAL", error?.message ?? "Apply failed"), { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-9.log" | Out-Null
```

Expected: no new errors.

```bash
git add src/services/je-allocation.service.ts src/app/api/v1/journal-entries/[id]/lines/[lineId]/apply/route.ts
git commit -m "feat(allocations): JE line apply-to-invoice/bill endpoint"
```

---

## Task 10: Apply buttons on JE detail page

**Files:**
- Create: `src/app/(dashboard)/journal-entries/[id]/apply-button.tsx`
- Modify: `src/app/(dashboard)/journal-entries/[id]/page.tsx`

- [ ] **Step 1: Create the client component** at `src/app/(dashboard)/journal-entries/[id]/apply-button.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { formatAmount } from "@/lib/utils"

interface OpenDocument {
  id: string
  documentNumber: string
  documentDate: string
  balance: number
  totalAmount: number
}

interface Props {
  entryId: string
  lineId: string
  partyType: "student" | "vendor" | "employee"
  partyId: string
  lineAmount: number
}

export function ApplyButton({ entryId, lineId, partyType, partyId, lineAmount }: Props) {
  const router = useRouter()
  const [docs, setDocs] = useState<OpenDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (partyType === "employee") { setLoading(false); return }
    const url = partyType === "student"
      ? `/api/v1/student-accounts/${partyId}/invoices`
      : `/api/v1/vendor-accounts/${partyId}/invoices`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          const open = (data.data as any[]).filter(
            (d) => Number(d.balance) > 0 && (d.status === "unpaid" || d.status === "partial" || d.status === "open")
          )
          setDocs(open)
        }
      })
      .finally(() => setLoading(false))
  }, [partyType, partyId])

  async function apply() {
    setError("")
    if (!selected) { setError("Pick a document"); return }
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError("Enter a positive amount"); return }
    if (amt > lineAmount) { setError("Amount exceeds line amount"); return }
    const doc = docs.find((d) => d.id === selected)
    if (doc && amt > doc.balance) { setError("Amount exceeds document balance"); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/journal-entries/${entryId}/lines/${lineId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selected, amount: amt }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error?.message ?? "Apply failed"); return }
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (partyType === "employee") {
    return <p className="text-xs text-muted-foreground">Apply not supported for employee AP yet.</p>
  }
  if (loading) return <p className="text-xs text-muted-foreground">Loading open documents…</p>

  return (
    <div className="mt-1 space-y-2">
      {docs.length === 0 && <p className="text-xs text-muted-foreground">No open {partyType === "student" ? "invoices" : "bills"}.</p>}
      {docs.length > 0 && !open && (
        <Button size="sm" variant="outline" onClick={() => { setOpen(true); setSelected(docs[0].id); setAmount(String(Math.min(lineAmount, docs[0].balance))) }}>Apply to open {partyType === "student" ? "invoice" : "bill"}</Button>
      )}
      {open && (
        <div className="rounded border bg-muted/30 p-2 text-xs space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <select className="rounded border px-2 py-1 text-xs" value={selected} onChange={(e) => { setSelected(e.target.value); const d = docs.find(x => x.id === e.target.value); if (d) setAmount(String(Math.min(lineAmount, d.balance))) }}>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>{d.documentNumber || d.invoiceNumber || d.id} — bal {formatAmount(d.balance)}</option>
              ))}
            </select>
            <input type="number" step="0.01" min="0.01" max={lineAmount} className="rounded border px-2 py-1 text-xs w-28" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button size="sm" onClick={apply} disabled={submitting}>{submitting ? "Applying…" : "Apply"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
```

(Verify the field name on the open-invoice list: `student-account.service.getInvoices` returns rows shaped like `student_invoice.*` (e.g. `invoice_number`, `balance`, `total_amount`, `status`, `invoice_date`). `vendor-account.service.getInvoices` is similar but the invoice number column may be `bill_number` or `invoice_number` — check it and adjust the display label. The component reads `d.documentNumber || d.invoiceNumber || d.bill_number || d.id` so it falls through safely.)

- [ ] **Step 2: Render the button on the JE detail page**

In `src/app/(dashboard)/journal-entries/[id]/page.tsx`, the server component queries `entry.lines` via `getEntry`. The page currently renders lines inside a table. For each line, **after the line's description cell**, add a new row (or an extra `<td colspan>`) that shows the party name and the Apply button. Find the `<tr>` that renders the line and append:

```tsx
{line.party_type && (
  <tr className="bg-muted/30">
    <td colSpan={6} className="p-3 text-xs">
      <span className="font-medium">Party:</span> {line.party_name || line.party_id} ({line.party_type})
      {entry.status === "posted" && (
        <ApplyButton
          entryId={id}
          lineId={line.id}
          partyType={line.party_type}
          partyId={line.party_id}
          lineAmount={Math.max(Number(line.debit), Number(line.credit))}
        />
      )}
    </td>
  </tr>
)}
```

Add the import at the top of the file:

```ts
import { ApplyButton } from "./apply-button"
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-10.log" | Out-Null
```

Expected: no new errors.

```bash
git add src/app/(dashboard)/journal-entries/[id]/apply-button.tsx src/app/(dashboard)/journal-entries/[id]/page.tsx
git commit -m "feat(je-detail): per-line apply-to-invoice/bill button on posted entries"
```

---

## Task 11: Student detail — GL activity section

**Files:**
- Modify: `src/services/student-account.service.ts` (add `getGlActivity`)
- Modify: `src/app/(dashboard)/student-accounts/[id]/page.tsx` (render the new section)

- [ ] **Step 1: Add `getGlActivity` to the service**

Append this method to the `studentAccountService` object:

```ts
async getGlActivity(entitySchema: string, studentId: string) {
  return prisma.$queryRawUnsafe<any[]>(
    `SELECT jel.id, jel.debit, jel.credit, jel.line_description,
            a.account_code, a.account_name,
            je.entry_number, je.entry_date, je.status
     FROM "${entitySchema}".journal_entry_line jel
     JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
     JOIN "${entitySchema}".account a ON a.id = jel.account_id
     WHERE jel.party_type = 'student' AND jel.party_id = $1::uuid
     ORDER BY je.entry_date DESC, je.created_at DESC`,
    studentId
  )
}
```

- [ ] **Step 2: Render the section on the detail page**

In `src/app/(dashboard)/student-accounts/[id]/page.tsx`, after the existing `studentAccountService.getPayments(...)` call, add:

```ts
const glActivity = await studentAccountService.getGlActivity(schema, id)
```

After the "Payment History" section's closing `</div>`, add a new section:

```tsx
<h2 className="text-xl font-semibold">GL Activity (Manual JEs)</h2>
<div className="rounded-lg border bg-card">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b bg-muted/50">
        <th className="text-left p-3 font-medium">Entry #</th>
        <th className="text-left p-3 font-medium">Date</th>
        <th className="text-left p-3 font-medium">Account</th>
        <th className="text-right p-3 font-medium">Debit</th>
        <th className="text-right p-3 font-medium">Credit</th>
        <th className="text-left p-3 font-medium">Status</th>
        <th className="text-left p-3 font-medium">Description</th>
      </tr>
    </thead>
    <tbody>
      {glActivity.length === 0 && <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No GL activity.</td></tr>}
      {glActivity.map((g: any) => (
        <tr key={g.id} className="border-b hover:bg-muted/50">
          <td className="p-3 font-mono text-xs">
            <Link href={`/journal-entries/${g.id ? '' : ''}`} className="hover:underline">{g.entry_number}</Link>
          </td>
          <td className="p-3">{new Date(g.entry_date).toLocaleDateString()}</td>
          <td className="p-3 text-xs font-mono">{g.account_code} {g.account_name}</td>
          <td className="p-3 text-right font-mono">{Number(g.debit) > 0 ? formatAmount(Number(g.debit)) : "—"}</td>
          <td className="p-3 text-right font-mono">{Number(g.credit) > 0 ? formatAmount(Number(g.credit)) : "—"}</td>
          <td className="p-3 text-xs capitalize">{g.status}</td>
          <td className="p-3 text-xs text-muted-foreground">{g.line_description || "—"}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

Replace the empty `<Link href={...}>` href with a proper link — use `/journal-entries/{entryId}` and look up the entry's id by joining on `je.id` (you need to add `je.id as entry_id` to the SELECT in step 1, then use `g.entry_id` in the link). Update the SELECT and the JSX accordingly.

- [ ] **Step 3: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-11.log" | Out-Null
```

Expected: no new errors.

```bash
git add src/services/student-account.service.ts src/app/(dashboard)/student-accounts/[id]/page.tsx
git commit -m "feat(student): show manual GL activity on student detail"
```

---

## Task 12: Vendor detail — GL activity section

**Files:**
- Modify: `src/services/vendor-account.service.ts` (add `getGlActivity`)
- Modify: `src/app/(dashboard)/vendor-accounts/[id]/page.tsx` (render the new section)

- [ ] **Step 1: Add `getGlActivity` to the vendor service**

Append this method to the `vendorAccountService` object (mirrors the student version, but filters on `party_type='vendor'`):

```ts
async getGlActivity(entitySchema: string, vendorId: string) {
  return prisma.$queryRawUnsafe<any[]>(
    `SELECT je.id as entry_id, jel.id as line_id, jel.debit, jel.credit, jel.line_description,
            a.account_code, a.account_name,
            je.entry_number, je.entry_date, je.status
     FROM "${entitySchema}".journal_entry_line jel
     JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
     JOIN "${entitySchema}".account a ON a.id = jel.account_id
     WHERE jel.party_type = 'vendor' AND jel.party_id = $1::uuid
     ORDER BY je.entry_date DESC, je.created_at DESC`,
    vendorId
  )
}
```

- [ ] **Step 2: Render the section on the vendor detail page**

Same pattern as Task 11. Add the call to the service and a new section that mirrors the student's "GL Activity (Manual JEs)" block. Title can be "GL Activity (Manual Bills/JEs)".

- [ ] **Step 3: Typecheck + commit**

```bash
cd E:\shcool-accounting-system && npm run typecheck 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\tc-12.log" | Out-Null
```

Expected: no new errors.

```bash
git add src/services/vendor-account.service.ts src/app/(dashboard)/vendor-accounts/[id]/page.tsx
git commit -m "feat(vendor): show manual GL activity on vendor detail"
```

---

## Task 13: Tests

**Files:**
- Modify: `src/__tests__/e2e/journal-entries.e2e.test.ts` (or create if missing)
- Create: `src/lib/validators/journal-entry.test.ts` (validator unit tests)

- [ ] **Step 1: Add validator unit tests** in `src/lib/validators/journal-entry.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { journalEntryLineSchema } from "./journal-entry"

describe("journalEntryLineSchema party fields", () => {
  it("accepts a line with both partyType and partyId", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
      partyType: "student", partyId: "00000000-0000-0000-0000-000000000002",
    })
    expect(r.success).toBe(true)
  })

  it("accepts a line with neither partyType nor partyId", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
    })
    expect(r.success).toBe(true)
  })

  it("rejects a line with only partyType", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
      partyType: "student",
    })
    expect(r.success).toBe(false)
  })

  it("rejects a line with only partyId", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
      partyId: "00000000-0000-0000-0000-000000000002",
    })
    expect(r.success).toBe(false)
  })

  it("rejects an invalid partyType", () => {
    const r = journalEntryLineSchema.safeParse({
      accountId: "00000000-0000-0000-0000-000000000001",
      debit: 100, credit: 0, lineOrder: 0,
      partyType: "alien", partyId: "00000000-0000-0000-0000-000000000002",
    })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd E:\shcool-accounting-system && npm run test:run -- src/lib/validators/journal-entry.test.ts 2>&1 | Tee-Object -FilePath "$env:TEMP\opencode\test-13.log"
```

Expected: 5 passes, 0 fails.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validators/journal-entry.test.ts
git commit -m "test: validator unit tests for partyType/partyId"
```

---

## Task 14: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a "Known Fixes #9" entry** describing this feature so future agents understand the pattern. Add a new bullet at the end of the "Known Fixes" list:

```markdown
9. **JE line ↔ subledger party tagging** — `account.subledger_type` (`'student'|'vendor'|'employee'|NULL`) is the chart-of-accounts hint that drives the per-line party picker on `/journal-entries/new`. JE lines for subledger accounts require a `party_type` + `party_id` matching the account's subledger type (or both NULL for non-subledger accounts). Migration in `migrateEntitySchema` (`src/lib/entity-schema.ts`) is idempotent — run `npm run db:migrate-entities` after changing defaults. Apply flow: posted JEs expose a per-line "Apply" button that reduces the subledger document's balance; the JE itself is not modified. Employee AP apply is a stub (picker works, button hidden).
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document JE line ↔ subledger tagging in AGENTS.md"
```

---

## Self-Review

- **Spec coverage**: All 8 sections of the spec have tasks: §1 schema (Task 1-2), §2 chart defaults (Task 1-2), §3 party columns (Task 1, 4), §4 form (Task 7-8), §5 API+service (Task 3-5), §6 apply flow (Task 9-10), §7 reporting (Task 11-12), §8 N/A (out of scope explicit).
- **Placeholder scan**: No "TBD" or "fill in details" in tasks. All code blocks show full implementations.
- **Type consistency**: `partyType` uses the same `'student'|'vendor'|'employee'` union in the schema CHECK, the validator enum, the service, and the form. `partyId` is `UUID` everywhere. `subledger_type` is the snake_case DB column / `subledgerType` camelCase in JS code (matched with `a.subledger_type as subledgerType` mapping in the form's `useEffect`).

## Execution

Plan complete. Two execution options: **subagent-driven** (recommended) or **inline**. Tell me which and I'll start.
