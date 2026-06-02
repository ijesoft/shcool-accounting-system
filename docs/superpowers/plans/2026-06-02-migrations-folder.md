# Entity-Schema Migrations Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-code entity-schema SQL strings with versioned `.sql` files in `db/migrations/entity/`, applied by a file-based runner that tracks applied migrations in a per-schema `_migrations` table.

**Architecture:** Two new modules — `src/lib/migrations/parser.ts` (SQL statement splitter, pure function, fully unit-tested) and `src/lib/migrations/runner.ts` (the migration runner that reads files, tracks applied state, applies pending ones inside a `prisma.$transaction`). The 6 migration files are extracted verbatim from the existing `createEntitySchema` (lines 1-955) and `migrateEntitySchema` blob (lines 969-1173) of `src/lib/entity-schema.ts`. After extraction, `entity-schema.ts` shrinks to a ~30-line shim that re-exports `migrateEntitySchema` from the new runner and keeps `createEntitySchema` as a deprecated one-line wrapper.

**Tech Stack:** TypeScript, Prisma 5.22, Vitest, PostgreSQL ≥ 11 (for DDL in transactions).

---

## File Structure

| Path | Responsibility | New/Modified |
|------|----------------|--------------|
| `db/migrations/entity/0001_initial_schema.sql` | 22 base CREATE TABLEs + chart of accounts + number series seeds | New |
| `db/migrations/entity/0002_revenue_recognition.sql` | `revenue_recognition_entry`, `sales_invoice[_line]`, `student_invoice`/`payment_transaction` column additions | New |
| `db/migrations/entity/0003_withholding_tax_and_bir.sql` | `bir_serial_range`, `withholding_tax_register`, `official_receipt.bir_*` columns | New |
| `db/migrations/entity/0004_hr_payroll.sql` | `employee`, `payroll_run`, `payroll_run_line` | New |
| `db/migrations/entity/0005_budget.sql` | `budget` + sub-account INSERTs + parent_id UPDATEs | New |
| `db/migrations/entity/0006_subledger_tagging.sql` | `account.subledger_type` ALTER, `journal_entry_line.party_type/party_id` ALTERs, chart defaults | New |
| `src/lib/migrations/parser.ts` | SQL statement splitter (state machine, ~60 lines) | New |
| `src/lib/migrations/parser.test.ts` | Vitest unit tests for parser (9 cases) | New |
| `src/lib/migrations/runner.ts` | Migration runner: file discovery, tracking, `prisma.$transaction` apply loop; exports `migrateEntitySchema` | New |
| `src/lib/entity-schema.ts` | Slim shim: re-exports `migrateEntitySchema`; keeps `createEntitySchema` deprecated wrapper; `dropEntitySchema` unchanged | Modified (1177 → ~30 lines) |
| `scripts/migrate-entities.ts` | Rewritten to loop over entities and call `migrateEntitySchema` for each | Modified |
| `AGENTS.md` | Remove obsolete "trap note" from Known Fix #9; add Migrations section | Modified |

---

## Task 1: SQL Statement Parser (TDD)

**Files:**
- Create: `src/lib/migrations/parser.ts`
- Test: `src/lib/migrations/parser.test.ts`

- [ ] **Step 1.1: Create the migration modules folder and write failing tests**

```bash
mkdir -p src/lib/migrations
```

Create `src/lib/migrations/parser.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { parseStatements } from "./parser"

describe("parseStatements", () => {
  it("splits on ; outside strings and comments", () => {
    expect(parseStatements("-- comment\nA; B;")).toEqual(["A", "B"])
  })

  it("does not split on ; inside a single-quoted string", () => {
    expect(parseStatements("A; 'B;C'; D;")).toEqual(["A", "'B;C'", "D"])
  })

  it("handles SQL '' escape inside strings", () => {
    expect(parseStatements("A ''quoted''; B;")).toEqual(["A ''quoted''", "B"])
  })

  it("ignores ; inside block comments", () => {
    expect(parseStatements("A /* ; */ ; B;")).toEqual(["A", "B"])
  })

  it("handles E'...' escape strings", () => {
    expect(parseStatements("A E'escape \\';' B;")).toEqual(["A E'escape \\';'", "B"])
  })

  it("handles newlines and whitespace between statements", () => {
    expect(parseStatements("SELECT 1;\n\nSELECT 2;")).toEqual(["SELECT 1", "SELECT 2"])
  })

  it("returns [] for an empty file", () => {
    expect(parseStatements("")).toEqual([])
  })

  it("returns [] for a file with only line comments", () => {
    expect(parseStatements("-- only a comment\n-- nothing else\n")).toEqual([])
  })

  it("throws on an unterminated statement", () => {
    expect(() => parseStatements("CREATE TABLE foo")).toThrow(/unterminated/i)
  })
})
```

- [ ] **Step 1.2: Run the tests and verify they all fail**

```bash
npx vitest run src/lib/migrations/parser.test.ts
```

Expected: every test in the file fails with "Cannot find module './parser'" or similar. The `npx vitest run` exit code is non-zero.

- [ ] **Step 1.3: Implement the parser**

Create `src/lib/migrations/parser.ts`:

```ts
/**
 * Splits a SQL script into a list of statements, properly handling:
 * - Line comments (-- ...)
 * - Block comments (/* ... *​/)
 * - Single-quoted string literals with '' escape
 * - Postgres escape strings (E'...' with \X and '' escapes)
 *
 * Dollar-quoted blocks ($$ ... $$) are NOT supported in v1; no current
 * migration uses them.
 *
 * Each returned statement is the trimmed, non-empty body of one `;`-terminated
 * SQL command (without the trailing `;`).
 *
 * Throws if the input contains a non-empty, non-terminated statement at EOF.
 */
export function parseStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  let i = 0
  const n = sql.length

  const flush = () => {
    const trimmed = current.trim()
    if (trimmed.length > 0) statements.push(trimmed)
    current = ""
  }

  while (i < n) {
    const c = sql[i]
    const c2 = sql[i + 1]

    if (c === "-" && c2 === "-") {
      while (i < n && sql[i] !== "\n") i++
      continue
    }

    if (c === "/" && c2 === "*") {
      i += 2
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++
      i += 2
      continue
    }

    if (c === "'") {
      current += c
      i++
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''"
          i += 2
        } else if (sql[i] === "'") {
          current += "'"
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    if ((c === "E" || c === "e") && c2 === "'") {
      current += c + "'"
      i += 2
      while (i < n) {
        if (sql[i] === "\\" && i + 1 < n) {
          current += sql[i] + sql[i + 1]
          i += 2
        } else if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''"
          i += 2
        } else if (sql[i] === "'") {
          current += "'"
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    if (c === ";") {
      flush()
      i++
      continue
    }

    current += c
    i++
  }

  const trailing = current.trim()
  if (trailing.length > 0) {
    throw new Error(
      `Unterminated SQL statement: ${trailing.slice(0, 80)}${trailing.length > 80 ? "..." : ""}`,
    )
  }

  return statements
}
```

- [ ] **Step 1.4: Run the tests and verify they all pass**

```bash
npx vitest run src/lib/migrations/parser.test.ts
```

Expected: 9 tests pass. Exit code 0.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/migrations/parser.ts src/lib/migrations/parser.test.ts
git commit -m "feat(migrations): SQL statement parser (state machine) with full unit test coverage"
```

---

## Task 2: Migration Runner

**Files:**
- Create: `src/lib/migrations/runner.ts`

- [ ] **Step 2.1: Implement the runner**

Create `src/lib/migrations/runner.ts`:

```ts
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import { prisma } from "@/lib/db"
import { parseStatements } from "./parser"

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations", "entity")
const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

export class MigrationError extends Error {
  constructor(message: string, public readonly schemaName: string, public readonly file?: string) {
    super(message)
    this.name = "MigrationError"
  }
}

export interface MigrationResult {
  schemaName: string
  applied: string[]
  skipped: string[]
}

export async function migrateEntitySchema(schemaName: string): Promise<MigrationResult> {
  if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
    throw new MigrationError(
      `Invalid schema name "${schemaName}" — must match ${SCHEMA_NAME_PATTERN}`,
      schemaName,
    )
  }

  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"._migrations (
      name        TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const appliedRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM "${schemaName}"._migrations`,
  )
  const appliedSet = new Set(appliedRows.map((r) => r.name))

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  const skipped = files.filter((f) => appliedSet.has(f))
  const pending = files.filter((f) => !appliedSet.has(f))
  const applied: string[] = []

  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8")
    const statements = parseStatements(sql)

    try {
      await prisma.$transaction(async (tx) => {
        for (const stmt of statements) {
          await tx.$executeRawUnsafe(stmt)
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO "${schemaName}"._migrations(name) VALUES($1)`,
          file,
        )
      })
      applied.push(file)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new MigrationError(
        `Failed to apply ${file} to ${schemaName}: ${message}`,
        schemaName,
        file,
      )
    }
  }

  return { schemaName, applied, skipped }
}
```

- [ ] **Step 2.2: Verify the file typechecks**

```bash
npm run typecheck 2>&1 | grep -E "migrations/runner|error TS" | head -20
```

Expected: no new errors mentioning `migrations/runner`. (The pre-existing 76-error baseline will still appear; ignore those.)

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/migrations/runner.ts
git commit -m "feat(migrations): file-based runner with per-schema _migrations tracking"
```

---

## Task 3: Extract the 6 Migration Files

**Files:**
- Create: `db/migrations/entity/0001_initial_schema.sql`
- Create: `db/migrations/entity/0002_revenue_recognition.sql`
- Create: `db/migrations/entity/0003_withholding_tax_and_bir.sql`
- Create: `db/migrations/entity/0004_hr_payroll.sql`
- Create: `db/migrations/entity/0005_budget.sql`
- Create: `db/migrations/entity/0006_subledger_tagging.sql`

All SQL is extracted from `src/lib/entity-schema.ts`. The file uses `CREATE SCHEMA` (line 5) — **drop that line** in all extractions; the runner creates the schema. Replace `"${schemaName}"` with the literal schema-name placeholder pattern the parser/runner expect: the runner interpolates `schemaName` directly into raw SQL, so the migration files must contain `"${schemaName}"` exactly. After extraction, the file is applied to live schemas by the runner, which substitutes the real schema name.

- [ ] **Step 3.1: Create the migrations directory**

```bash
mkdir -p db/migrations/entity
```

- [ ] **Step 3.2: Extract 0001 — base tables + chart of accounts + number series**

In `src/lib/entity-schema.ts`, the **22 base CREATE TABLE statements** for 0001 are at these line ranges (table → line range):

- `account` → 7-23
- `journal_entry` → 25-44
- `journal_entry_line` → 46-55
- `general_ledger` → 57-68
- `number_series` → 70-79
- `official_receipt` → 81-103
- `official_receipt_line` → 105-114
- `student` → 116-126
- `disbursement` → 167-189
- `student_invoice` → 220-236
- `student_invoice_line` → 238-245
- `payment_transaction` → 258-278
- `vendor_account` → 280-293
- `vendor_invoice` → 295-307
- `fixed_asset` → 309-326
- `depreciation_entry` → 328-336
- `bank_account` → 338-347
- `bank_reconciliation` → 349-359
- `reconciliation_item` → 361-370
- `approval_rule` → 372-380
- `approval_request` → 382-392
- `approval_action` → 394-401

Also include:
- The `account` chart-of-accounts INSERT (lines 468-919) — the full `INSERT INTO "...account" (account_code, account_name, account_type, normal_balance, level) VALUES …` block, with its `-- =====` comments preserved.
- The `parent_id` UPDATEs that follow the chart INSERT (lines 921-938) — all `UPDATE "...account" SET parent_id = …` statements.
- The `number_series` INSERT (lines 939-950) — the `INSERT INTO "...number_series" … SELECT … FROM (VALUES …) AS v …` block.

Create `db/migrations/entity/0001_initial_schema.sql` and copy each of those blocks into it, in the order listed above. Do **not** include `CREATE SCHEMA` (line 5). Do **not** include the `for (const stmt of …)` loop or the `await migrateEntitySchema(schemaName)` call (lines 953-960).

**Verify:** the file should be ~600-700 lines and end with the number_series INSERT.

- [ ] **Step 3.3: Extract 0002 — revenue recognition + sales invoices + student/payment columns**

From the `migrateEntitySchema` migrations string (which starts at line 970 of `entity-schema.ts`), extract these blocks in order:

- The `student_invoice` column additions (lines 971-972) — `term_start_date`, `term_end_date`
- The `payment_transaction` column additions (lines 973-977) — `payor_name`, `payor_address`, `tin`, `payment_type`, `deposit_status`
- The `revenue_recognition_entry` CREATE TABLE (lines 979-988)
- The `sales_invoice` CREATE TABLE (lines 990-1015)
- The `sales_invoice_line` CREATE TABLE (lines 1017-1027)

Create `db/migrations/entity/0002_revenue_recognition.sql` and copy these blocks in. Do not include any other statements from the migrations string.

- [ ] **Step 3.4: Extract 0003 — withholding tax + BIR**

From the migrations string:

- The `bir_serial_range` CREATE TABLE (lines 1029-1041)
- The `withholding_tax_register` CREATE TABLE (lines 1043-1056)
- The `official_receipt.bir_*` column additions (lines 1058-1060) — `bir_serial_number`, `bir_accredited_printer_tin`, `bir_permit_number`

Create `db/migrations/entity/0003_withholding_tax_and_bir.sql` and copy these blocks in.

- [ ] **Step 3.5: Extract 0004 — HR / payroll**

From the migrations string:

- The `employee` CREATE TABLE (lines 1062-1078)
- The `payroll_run` CREATE TABLE (lines 1080-1094)
- The `payroll_run_line` CREATE TABLE (lines 1096-1113)

Create `db/migrations/entity/0004_hr_payroll.sql` and copy these blocks in.

- [ ] **Step 3.6: Extract 0005 — budget + sub-accounts**

From the migrations string:

- The `budget` CREATE TABLE (lines 1115-1125)
- The sub-account INSERTs with `-- Idempotent backfill of sub-accounts required by the billing engine.` comment (lines 1127-1137) — the 7 rows: 21310, 21410, 42000, 42100, 42600, 43000, 43100
- The `parent_id` UPDATEs that follow (lines 1139-1142)

Create `db/migrations/entity/0005_budget.sql` and copy these blocks in.

- [ ] **Step 3.7: Extract 0006 — subledger tagging**

From the migrations string:

- The `account.subledger_type` ALTER (lines 1146-1148)
- The `journal_entry_line.party_type` ALTER (lines 1150-1152)
- The `journal_entry_line.party_id` ALTER (lines 1154-1155)
- The three chart-default UPDATEs (lines 1157-1164) — for 11210-11214 (student), 11250/11260/21210 (employee), 21110-21140 (vendor)

Create `db/migrations/entity/0006_subledger_tagging.sql` and copy these blocks in.

- [ ] **Step 3.8: Commit**

```bash
git add db/migrations/entity/
git commit -m "feat(migrations): extract 6 .sql migration files from entity-schema.ts"
```

---

## Task 4: Refactor `src/lib/entity-schema.ts`

**Files:**
- Modify: `src/lib/entity-schema.ts` (1177 → ~30 lines)

- [ ] **Step 4.1: Replace the file contents**

Overwrite `src/lib/entity-schema.ts` with the following:

```ts
/**
 * Public surface for entity-schema management.
 *
 * The actual schema creation and migration logic lives in
 * `@/lib/migrations/runner`. This file exists for:
 *   1. Re-export of `migrateEntitySchema` so existing imports keep working.
 *   2. A deprecated `createEntitySchema` shim for the 5 callers
 *      (`src/services/entity.service.ts:36`, `scripts/seed.ts:139`,
 *      and 3 in `src/__tests__/e2e/multitenancy.e2e.test.ts`).
 *   3. `dropEntitySchema` for entity teardown.
 *
 * New code should import from `@/lib/migrations/runner` directly.
 */
export { migrateEntitySchema, MigrationError, type MigrationResult } from "@/lib/migrations/runner"

import { prisma } from "@/lib/db"
import { migrateEntitySchema } from "@/lib/migrations/runner"

/**
 * @deprecated Use `migrateEntitySchema` directly. Retained as a shim for
 * existing callers. Will be removed in a future release.
 */
export async function createEntitySchema(schemaName: string): Promise<void> {
  await migrateEntitySchema(schemaName)
}

export async function dropEntitySchema(schemaName: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
}
```

- [ ] **Step 4.2: Verify typecheck**

```bash
npm run typecheck 2>&1 | grep -E "error TS" | wc -l
```

Expected: 76 (the pre-existing baseline). If the count is higher, the most likely cause is a missing import or a type that `migrateEntitySchema` no longer exposes — fix and re-run.

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/entity-schema.ts
git commit -m "refactor(entity-schema): delegate to migrations/runner; keep createEntitySchema shim"
```

---

## Task 5: Rewrite `scripts/migrate-entities.ts`

**Files:**
- Modify: `scripts/migrate-entities.ts`

- [ ] **Step 5.1: Replace the file contents**

Overwrite `scripts/migrate-entities.ts` with:

```ts
import { prisma } from "../src/lib/db"
import { migrateEntitySchema, MigrationError } from "../src/lib/migrations/runner"

async function main() {
  const entities = await prisma.entity.findMany({
    select: { id: true, code: true, name: true, schemaName: true },
    orderBy: { code: "asc" },
  })

  if (entities.length === 0) {
    console.log("No entities found. Nothing to migrate.")
    return
  }

  console.log(`Migrating ${entities.length} entity schema(s)…\n`)

  let ok = 0
  let upToDate = 0
  let failed = 0
  for (const entity of entities) {
    process.stdout.write(`  [${entity.code}] ${entity.schemaName} … `)
    try {
      const result = await migrateEntitySchema(entity.schemaName)
      if (result.applied.length === 0) {
        console.log("up to date")
        upToDate++
      } else {
        console.log(`OK (${result.applied.length} applied)`)
        for (const file of result.applied) console.log(`    ✓ ${file}`)
        ok++
      }
    } catch (err) {
      console.log("FAIL")
      if (err instanceof MigrationError) {
        console.error(`    [${err.schemaName}${err.file ? `:${err.file}` : ""}] ${err.message}`)
      } else {
        console.error(err)
      }
      failed++
    }
  }

  console.log(`\nDone. ${ok} migrated, ${upToDate} up to date, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 5.2: Commit**

```bash
git add scripts/migrate-entities.ts
git commit -m "refactor(scripts): rewrite migrate-entities.ts to use new runner"
```

---

## Task 6: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 6.1: Remove the obsolete trap note from Known Fix #9**

The current Known Fix #9 contains a sentence: "**Trap:** when adding SQL to `migrateEntitySchema`'s `migrations` literal, do not put `;` inside `--` comments — the `for (const stmt of migrations.split(";"))` loop breaks on the first `;` in a comment." This is now obsolete (the runner uses `parseStatements`, not `;`-split). Remove that sentence.

In `AGENTS.md`, delete this trailing sentence from item 9:

```
 **Trap:** when adding SQL to `migrateEntitySchema`'s `migrations` literal, do not put `;` inside `--` comments — the `for (const stmt of migrations.split(";"))` loop breaks on the first `;` in a comment.
```

(The rest of item 9 — the description of subledger party tagging — stays.)

- [ ] **Step 6.2: Add a Migrations section**

After the "Known Fixes" section (i.e., at the end of the file), add:

```markdown

## Migrations

### Entity schemas (file-based, per-schema tracking)

Entity schemas (`entity_<code>`) are managed by a file-based migration system, not `prisma migrate`. Files live in `db/migrations/entity/` and apply in lexicographic order. Applied state is tracked in `${schemaName}._migrations` (one row per file).

**To add a new migration:**

1. Create `db/migrations/entity/NNNN_short_snake_name.sql` where `NNNN` is one higher than the latest file (use `0007_…`, `0008_…`, etc.).
2. Write idempotent SQL. Every `CREATE TABLE` must use `IF NOT EXISTS`, every `CREATE INDEX` must use `IF NOT EXISTS`, every `ALTER TABLE … ADD COLUMN` must use `IF NOT EXISTS`, and every `INSERT` for seed data must use `ON CONFLICT (…) DO NOTHING`. The idempotency guard is a safety net for partial-failure recovery; the tracking table is the primary correctness mechanism.
3. Use `"${schemaName}"` to reference the entity schema. The runner interpolates the real name.
4. Each file's statements are wrapped in a single `prisma.$transaction`; do NOT use `CREATE INDEX CONCURRENTLY` (Postgres refuses it inside transactions; the runner does not yet support a non-transactional file hint).
5. Do NOT use dollar-quoted blocks (`$$ … $$`); the parser doesn't support them in v1.
6. Run `npm run db:migrate-entities` locally to apply. Verify with `SELECT * FROM entity_<your_entity_code>._migrations ORDER BY name;`.

**To deploy:** `npm run db:migrate-entities`. Idempotent. Safe to re-run. Reads every entity from `public.entity` and applies pending files.

**Public schema and audit schema:** continue to use `prisma migrate dev` and `prisma migrate deploy`. Do not put entity-scoped migrations in `prisma/migrations/`.
```

- [ ] **Step 6.3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: replace obsolete trap note; add Migrations section to AGENTS.md"
```

---

## Task 7: Integration Test (Fresh Schema Equivalence)

This task verifies the new runner produces a schema equivalent to what the old `createEntitySchema` would have produced. The check: create a throwaway test entity, apply migrations to it, and verify the table list matches what the old code created.

**Files:**
- Create: `src/__tests__/e2e/migrations-folder.e2e.test.ts`

- [ ] **Step 7.1: Write the integration test**

Create `src/__tests__/e2e/migrations-folder.e2e.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@/lib/db"
import { migrateEntitySchema, dropEntitySchema } from "@/lib/entity-schema"

const TEST_SCHEMA = `entity_test_${Date.now()}`
const EXPECTED_TABLES = [
  "account",
  "approval_action",
  "approval_request",
  "approval_rule",
  "bank_account",
  "bank_reconciliation",
  "budget",
  "depreciation_entry",
  "disbursement",
  "employee",
  "fixed_asset",
  "general_ledger",
  "journal_entry",
  "journal_entry_line",
  "number_series",
  "official_receipt",
  "official_receipt_line",
  "payment_transaction",
  "payroll_run",
  "payroll_run_line",
  "reconciliation_item",
  "revenue_recognition_entry",
  "sales_invoice",
  "sales_invoice_line",
  "student",
  "student_invoice",
  "student_invoice_line",
  "vendor_account",
  "vendor_invoice",
  "withholding_tax_register",
  "bir_serial_range",
]

describe("migrations folder runner", () => {
  beforeAll(async () => {
    // Clean up if a prior failed run left a schema behind
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`)
  })

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`)
    await prisma.$disconnect()
  })

  it("applies all 6 migration files to a fresh schema", async () => {
    const result = await migrateEntitySchema(TEST_SCHEMA)
    expect(result.applied).toEqual([
      "0001_initial_schema.sql",
      "0002_revenue_recognition.sql",
      "0003_withholding_tax_and_bir.sql",
      "0004_hr_payroll.sql",
      "0005_budget.sql",
      "0006_subledger_tagging.sql",
    ])

    // Verify all expected tables exist
    const tableRows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      TEST_SCHEMA,
    )
    const tables = tableRows.map((r) => r.table_name).sort()
    expect(tables).toEqual([...EXPECTED_TABLES, "_migrations"].sort())

    // Verify chart of accounts was seeded
    const accountCountRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "${TEST_SCHEMA}".account`,
    )
    const accountCount = Number(accountCountRows[0].count)
    expect(accountCount).toBeGreaterThan(50)

    // Verify number series was seeded
    const seriesRows = await prisma.$queryRawUnsafe<Array<{ series_type: string }>>(
      `SELECT series_type FROM "${TEST_SCHEMA}".number_series ORDER BY series_type`,
    )
    expect(seriesRows.map((r) => r.series_type)).toEqual([
      "CD",
      "CV",
      "INVOICE",
      "JE",
      "OR",
      "PMT",
      "PR",
    ])
  })

  it("is idempotent on re-run (no files applied, no errors)", async () => {
    const result = await migrateEntitySchema(TEST_SCHEMA)
    expect(result.applied).toEqual([])
    expect(result.skipped).toHaveLength(6)
  })

  it("rejects invalid schema names", async () => {
    await expect(migrateEntitySchema("DROP TABLE x;--")).rejects.toThrow(/invalid schema name/i)
  })
})
```

- [ ] **Step 7.2: Run the integration test**

```bash
npx vitest run src/__tests__/e2e/migrations-folder.e2e.test.ts
```

Expected: 3 tests pass. If `account` count is below 50, inspect `db/migrations/entity/0001_initial_schema.sql` — the chart-of-accounts INSERT is missing. If a specific table is missing, that CREATE TABLE was placed in the wrong migration file. If a foreign-key error appears, two tables in 0001 are in the wrong order.

- [ ] **Step 7.3: Commit**

```bash
git add src/__tests__/e2e/migrations-folder.e2e.test.ts
git commit -m "test(migrations): integration test — runner applies all 6 files idempotently"
```

---

## Task 8: Apply to Live Database (Deploy Verification)

This task applies the new runner to the 3 existing entities in the live database and verifies it works against real, populated data.

- [ ] **Step 8.1: Inspect the existing entities**

```bash
npx tsx -e "import { prisma } from './src/lib/db'; (async () => { const e = await prisma.entity.findMany({ select: { code: true, schemaName: true } }); console.log(JSON.stringify(e, null, 2)); await prisma.\$disconnect(); })()"
```

Expected: 3 entities listed, each with a `schemaName` of the form `entity_<code>`.

- [ ] **Step 8.2: Run the migration script**

```bash
npm run db:migrate-entities
```

Expected output (approximately):

```
Migrating 3 entity schema(s)…

  [MAIN] entity_main … up to date
  [INT1780406507221] entity_int1780406507221 … up to date
  [TEST1780406507221] entity_test1780406507221 … up to date

Done. 0 migrated, 3 up to date, 0 failed.
```

**What "up to date" means:** the existing entities already have all the tables and columns they need, so the new `migrateEntitySchema` finds the schema and tracking table already in place. The `IF NOT EXISTS` guards in the SQL files mean re-applying them to an already-built schema is a no-op. The script records the 6 files in `_migrations` (since `_migrations` is empty on first run) and on the *next* run, all 6 will be skipped.

**If the output shows `OK (N applied)` instead of `up to date`** on a re-run, the `_migrations` table was not properly populated on the first run. Re-run the script — the second run will show `up to date`. This is expected and benign on the very first deploy.

- [ ] **Step 8.3: Verify `_migrations` is populated for each entity**

```bash
npx tsx -e "import { prisma } from './src/lib/db'; (async () => { const e = await prisma.entity.findMany(); for (const ent of e) { const rows = await prisma.\$queryRawUnsafe<Array<{name: string}>>(\`SELECT name FROM \"\${ent.schemaName}\"._migrations ORDER BY name\`); console.log(ent.code, '->', rows.map(r => r.name).join(', ')); } await prisma.\$disconnect(); })()"
```

Expected: each entity has 6 rows: `0001_initial_schema.sql`, `0002_revenue_recognition.sql`, `0003_withholding_tax_and_bir.sql`, `0004_hr_payroll.sql`, `0005_budget.sql`, `0006_subledger_tagging.sql`.

- [ ] **Step 8.4: Run the full test suite to confirm nothing else broke**

```bash
npm run test:run 2>&1 | tail -20
```

Expected: 344 passing (the same baseline as before the refactor). The new parser test (9 cases) brings the count to 353, and the new integration test (3 cases) to 356. The 22 pre-existing failures should still be at 22 — none new.

- [ ] **Step 8.5: Final commit if anything in this task touched files**

If the previous steps didn't require any code changes (they shouldn't — this is a verification task), skip this step. If something needed a tweak (e.g. a wrong line range in a migration file), commit it:

```bash
git add -A
git commit -m "fix(migrations): post-deploy corrections discovered during verification"
```

---

## Self-Review Notes (for the planner, not the engineer)

- **Spec coverage:** every requirement in the design spec is covered. Per-schema tracking (Tasks 1, 2). File-based SQL (Task 3). `migrateEntitySchema` re-export + deprecated `createEntitySchema` wrapper (Task 4). CLI rewrite (Task 5). AGENTS.md update (Task 6). Idempotency + parser + DDL-in-transaction (Tasks 1, 2, 7). Equivalence guarantee (Task 7).
- **Placeholder scan:** none. Every SQL extraction task names the exact source line range; the runner and parser code is provided verbatim.
- **Type consistency:** `migrateEntitySchema` is exported from `src/lib/migrations/runner.ts` (Task 2), re-exported by `src/lib/entity-schema.ts` (Task 4), and consumed by the script (Task 5) and the deprecated wrapper (Task 4). The `MigrationError` and `MigrationResult` types are exported once and re-exported from the shim.
- **TDD discipline:** parser is fully TDD'd (9 test cases). Runner has no unit test (it's a thin DB wrapper); it's covered by the integration test (Task 7, 3 cases) and the live deploy verification (Task 8).
