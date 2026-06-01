# Phase 2: Core Accounting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the journal entry engine, posting engine, general ledger, trial balance, and audit trail — the core accounting engine.

**Architecture:** Service layer validates business rules (balance, period, account type), repository layer handles per-entity schema SQL, posting engine wraps everything in a DB transaction.

**Tech Stack:** Next.js 14+, Prisma (raw SQL for per-entity), Zod validation

---

### Task 1: Journal Entry Validator & Types
**Files:**
- Create: `src/lib/validators/journal-entry.ts`

### Task 2: Journal Entry Repository
**Files:**
- Create: `src/repositories/journal-entry.repository.ts`

### Task 3: General Ledger Repository
**Files:**
- Create: `src/repositories/ledger.repository.ts`

### Task 4: Posting Engine
**Files:**
- Create: `src/lib/accounting/posting-engine.ts`
- Create: `src/lib/accounting/financial-statements.ts`

### Task 5: Journal Entry Service
**Files:**
- Create: `src/services/journal-entry.service.ts`

### Task 6: Journal Entry API Routes
**Files:**
- Create: `src/app/api/v1/journal-entries/route.ts`
- Create: `src/app/api/v1/journal-entries/[id]/route.ts`
- Create: `src/app/api/v1/journal-entries/[id]/post/route.ts`
- Create: `src/app/api/v1/journal-entries/[id]/reverse/route.ts`

### Task 7: Trial Balance API
**Files:**
- Create: `src/app/api/v1/financial-reports/trial-balance/route.ts`
- Create: `src/services/report.service.ts`

### Task 8: Audit Trail Service
**Files:**
- Create: `src/lib/audit/audit-log.ts`

### Task 9: Journal Entry UI Pages
**Files:**
- Create: `src/app/(dashboard)/journal-entries/page.tsx`
- Create: `src/app/(dashboard)/journal-entries/new/page.tsx`
- Create: `src/app/(dashboard)/journal-entries/[id]/page.tsx`

### Task 10: Verification
- Run `npx tsc --noEmit`
- Verify zero errors
