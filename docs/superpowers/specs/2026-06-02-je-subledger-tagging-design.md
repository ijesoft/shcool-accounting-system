# Journal-Entry ↔ Subledger Integration (Student/Vendor Tagging)

**Status:** Draft for review
**Date:** 2026-06-02
**Scope:** `/journal-entries/new`, `/journal-entries/[id]`, `account` schema, posting engine, services.

## Problem

The Chart of Accounts contains control accounts for trade receivables (11210–11214: Tuition Receivable) and trade payables (21110–21140: AP – Trade/Utilities/Canteen/Bookstore). When a bookkeeper records a manual journal entry against these accounts, the system has **no way to link the GL line to the student or vendor** it actually relates to. This breaks:

- **Audit trail** — a JE hitting 11210 with no student is a "floating" control-account entry.
- **AR/AP aging reconciliation** — period-end reports cannot join GL activity to the subledger.
- **Subledger reporting** — student/vendor balance pages miss manual GL movements.

## Goal

When a JE line uses an account that represents amounts owed by a student (AR) or owed to a vendor (AP):

1. **Require a party reference on the line** (student or vendor) — per-line, not per-entry.
2. **Persist that reference on the line** for audit trail and reporting.
3. **Offer a one-click path** on the JE detail page to apply the line's amount to open invoices (for AR) or open bills (for AP).

This mirrors QuickBooks' behavior: pick the account, the right Name column (Customer/Vendor) appears; AR/AP lines cannot post without a name.

## Approach

Two parts:

- **A. Schema & form**: add a `subledger_type` column on the `account` table. The JE form reads this column to render the right picker per line. Server-side validation enforces: if the line's account has a subledger_type, the line must carry a party reference.
- **B. Apply flow**: on the JE detail page, for every AR/AP line, list open invoices/bills for the tagged party. A button per line auto-creates a subledger transaction (student payment allocation, vendor bill allocation) that draws down the invoice/bill.

## Detailed Design

### 1. Schema: `subledger_type` on `account`

Add a column to the existing `account` table (idempotent migration; runs in `migrateEntitySchema`):

```sql
ALTER TABLE "${schemaName}".account
  ADD COLUMN IF NOT EXISTS subledger_type VARCHAR(20)
    CHECK (subledger_type IN ('student', 'vendor', 'employee') OR subledger_type IS NULL);
```

Idempotent — re-running the migration is safe. Entities created before this design get the column on their next `db:migrate-entities` run.

### 2. Chart-of-accounts defaults (data migration)

Same migration, second part — backfill known accounts with the right subledger type:

| account_code range | subledger_type | reason |
|---|---|---|
| 11210, 11211, 11212, 11213, 11214 | `student` | Tuition Receivable sub-accounts |
| 11250+ (employee advances) | `employee` | Receivable from employees |
| 21110, 21120, 21130, 21140 | `vendor` | AP – Trade/Utilities/Canteen/Bookstore |
| 21210 | `employee` | Accrued Salaries and Wages |
| (everything else) | `NULL` | No subledger |

New accounts created later default to `NULL`. Admins can override via the chart-of-accounts edit page (out of scope for this feature; the column supports it).

### 3. JE schema: `party_type` + `party_id` on `journal_entry_line`

Extend the line table with two nullable columns:

```sql
ALTER TABLE "${schemaName}".journal_entry_line
  ADD COLUMN IF NOT EXISTS party_type VARCHAR(20)
    CHECK (party_type IN ('student', 'vendor', 'employee') OR party_type IS NULL);
ALTER TABLE "${schemaName}".journal_entry_line
  ADD COLUMN IF NOT EXISTS party_id UUID;
```

Rule at insert time: `party_type` and `party_id` are both set, or both NULL. Server validates that `party_type` matches the account's `subledger_type` (or both are NULL). Cross-tag (e.g. account subledger_type=student but party_type=vendor) is rejected.

### 4. Form: `/journal-entries/new`

Replace the "Account ID" input with `AccountAutocomplete` (already shipped). When the user picks an account whose `subledger_type` is not NULL, **a second input appears right under that line**:

- `subledger_type='student'` → **Customer** autocomplete (fetches `/api/v1/student-accounts`)
- `subledger_type='vendor'` → **Vendor** autocomplete (fetches `/api/v1/vendor-accounts`)
- `subledger_type='employee'` → **Employee** autocomplete (fetches `/api/v1/employees` — same pattern as students/vendors; picker functional even if employee-page is incomplete)

The party field is **required** when the account has a `subledger_type` and forbidden when it doesn't. Server-side validation mirrors this. Form-level error shown next to the line.

Add an **"+ New"** button next to the autocomplete, opening a small dialog to create a new student/vendor/employee inline (reuses the existing `create-student-dialog` pattern; for vendor/employee, similar dialogs would be needed — out of scope for v1, so the button is "Pick existing" only initially; "+ New" is a fast follow).

### 5. API: `POST /api/v1/journal-entries`

Update the Zod validator (`createJournalEntrySchema`) to accept the new `partyType` / `partyId` per line. The service (`journalEntryService.create` or `postingEngine.post`) validates:

```ts
if (account.subledger_type) {
  if (!line.partyId || line.partyType !== account.subledger_type) {
    throw new ValidationError(
      `Line ${i+1}: account ${account.accountCode} requires a ${account.subledger_type} party.`
    )
  }
} else {
  if (line.partyId) {
    throw new ValidationError(`Line ${i+1}: account ${account.accountCode} is not a subledger account.`)
  }
}
```

Verify the party exists and belongs to this entity (student/vendor/employee lookup with the entity's schema).

### 6. Apply flow: `/journal-entries/[id]`

For every line where `party_type` is set, render a small **"Apply to open invoice"** (or "…open bill") panel below the line:

- AR + student → fetch `/api/v1/student-accounts/[id]/invoices` filtered to `status='open'` and `balance_due > 0`
- AP + vendor → list of open bills (mirror — vendor-invoice API)
- AP + employee → not implemented in v1; show "Employee AP: not yet supported"

Each open invoice/bill shows: invoice number, date, balance, age. A per-line **"Apply"** button lets the user type an amount (capped at min(je line amount, invoice balance)) and confirm. On confirm, the system:

- Creates a `student_payment_allocation` (or `vendor_bill_allocation` — same shape, vendor side) that links the JE line to the invoice/bill and reduces the invoice balance
- The journal entry itself is **not** modified — it stays as the GL control-account entry; the allocation lives in the subledger

This matches QuickBooks' "Receive Payment" / "Pay Bills" → "Apply to open invoices" flow, but kicked off from the JE.

### 7. Reporting impact (out of scope, but verify)

- `/student-accounts/[id]` should now include manual GL AR postings (currently it only shows invoices and payments). One line in `getActivity` to UNION with `journal_entry_line` for `party_id = student.id` and `party_type='student'`.
- `/vendor-accounts/[id]` similar.

This is a one-line change in each service. Do it as part of this feature.

### 8. What this design explicitly does NOT do

- Does **not** auto-create a subledger invoice on JE post. The user must click "Apply" on the JE detail page. This keeps posting behavior predictable and reversible.
- Does **not** block unposted JEs from showing the Apply panel (the user can stage allocations before posting the JE). Actually — for safety, hide the panel until the JE is posted (because re-editing an unposted JE could invalidate allocations).
- Does **not** support partial-allocation edits after the fact. Once an allocation is created, it can only be reversed. Reversal flow is the same as the existing `reversePayment` pattern (a separate item, not part of this spec).

## Data Flow

```
User picks account (subledger_type='student')
   ↓
Form shows "Customer" autocomplete under that line
   ↓
User picks student OR creates a new one
   ↓
Form submits: line = { accountId, debit, credit, partyType: 'student', partyId, ... }
   ↓
API validates: account.subledger_type matches line.partyType; party exists
   ↓
JE saved with party columns populated
   ↓
JE submitted → approved → posted (existing workflow)
   ↓
On posted JE detail page: "Apply to open invoice" panel for that line
   ↓
User clicks Apply → subledger allocation created; invoice balance reduced
```

## Error Handling

- Account has `subledger_type` but line has no party → 400 from API; form shows inline error
- Party type mismatch (account=student, party=vendor) → 400
- Party ID does not exist or wrong entity → 404
- Apply amount > line amount or > invoice balance → form prevents
- Allocations on unposted JE → Apply panel hidden until status=posted

## Testing

- Unit test: validator rejects line with subledger_type account but missing party
- Unit test: validator rejects line with NULL subledger_type account but party present
- Unit test: validator accepts matching party
- Integration test: create JE with student party on AR line → row inserted with party_type/party_id
- Integration test: create JE with vendor party on AP line
- Integration test: Apply flow creates student_payment_allocation and reduces invoice balance
- E2E test: /journal-entries/new renders the right picker per account; submit succeeds; detail page shows Apply panel; Apply succeeds

## Files Affected

**New:**
- `src/components/customer-autocomplete.tsx` (wraps `/api/v1/student-accounts`)
- `src/components/vendor-autocomplete.tsx` (wraps `/api/v1/vendor-accounts`)
- `src/app/(dashboard)/journal-entries/[id]/apply-to-invoice-button.tsx`
- `src/app/(dashboard)/journal-entries/[id]/apply-to-bill-button.tsx`

**Modified:**
- `src/lib/entity-schema.ts` — add `subledger_type` migration; add `party_type`/`party_id` migration
- `src/lib/validators/journal-entry.ts` — extend line schema with partyType/partyId
- `src/services/journal-entry.service.ts` (or posting-engine) — validate party matches account
- `src/app/(dashboard)/journal-entries/new/page.tsx` — render pickers conditionally
- `src/app/(dashboard)/journal-entries/[id]/page.tsx` — show Apply panel per AR/AP line
- `src/services/student-account.service.ts:getActivity` — UNION JE lines for the student
- `src/services/vendor-account.service.ts:getActivity` — UNION JE lines for the vendor

**Reused:**
- `src/components/account-autocomplete.tsx` (already shipped)

## Rollout

1. Ship migration via `npm run db:migrate-entities` (idempotent).
2. Ship the new columns and validator changes (read-only, no UI impact yet).
3. Ship the form changes.
4. Ship the Apply flow.
5. Update student/vendor activity queries.
6. (Future) chart-of-accounts edit page that lets admins override `subledger_type`.

## Open Questions

None — all design decisions resolved with the user.
