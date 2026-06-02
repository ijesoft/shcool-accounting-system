# Entity-Schema Migrations Folder — Design

**Date:** 2026-06-02
**Status:** Proposed
**Scope:** Refactor the entity-scoped schema migrations from a single in-code string into a versioned, file-based migration system. Public/audit schemas are unchanged (stay on `prisma migrate`).

## Background

The codebase maintains a multi-tenant PostgreSQL database:

- **`public` and `audit` schemas** — managed by Prisma (`prisma/schema.prisma`). Models: `Entity`, `User`, `Role`, `Permission`, `FiscalYear`, `FiscalPeriod`, `AuditLog`. Migrations flow through `prisma migrate dev` / `prisma migrate deploy`.
- **`entity_<code>` schemas** — one per tenant, all ~14 accounting tables (`account`, `journal_entry`, `student_invoice`, etc.) plus a seeded chart of accounts and number series. These are NOT under Prisma's control because Prisma's `multiSchema` is a preview feature that cannot drive `prisma migrate` for dynamic per-tenant schemas.

Today, entity-schema SQL lives in two functions inside `src/lib/entity-schema.ts`:

1. `createEntitySchema(schemaName)` (lines 3-961) — defines the full schema and runs the first time a new entity is created. ~955 lines, including `CREATE SCHEMA`, 30+ `CREATE TABLE IF NOT EXISTS`, and seeded INSERTs for the chart of accounts and number series.
2. `migrateEntitySchema(schemaName)` (lines 969-1173) — a single backtick-string of ~50 idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` statements. The string is split by `;` and each statement is executed individually. This was extracted from `createEntitySchema` to make it safe to re-run on existing entities.

This works, but has three operational problems:

1. **No version history.** The same `migrateEntitySchema` is re-run on every deploy. The `IF NOT EXISTS` guards make it idempotent, but there's no record of what's been applied. If a new migration is added and a deployment partially fails, we have no way to know which half ran.
2. **The `;`-split parser is fragile.** The `for (const stmt of migrations.split(";"))` loop breaks on any `;` inside a SQL `--` comment. This was already a bug once (commit `3eec595`); it will bite again. (See AGENTS.md Known Fix #9 trap note.)
3. **Hard to read in code review.** A 200-line backtick string diff is unreadable. A `0001_initial_schema.sql` file is not.
4. **No first-time-entity creation path is separated from the upgrade path.** Both currently live in the same module, with the only difference being a flag in the function name.

## Goals

- Migration files are easy to read, review, and version-control.
- Each file applies exactly once per entity schema; re-runs are no-ops.
- The deploy command is one line and is safe to run repeatedly.
- New entity creation reuses the same runner — no special "first time" code path.
- Partial failures are recoverable: resume from the failed file.

## Non-Goals

- No down-migrations. Forward-only. (Standard modern migration practice — see Flyway, sqlx, Rails.)
- No replacement for `prisma migrate` on public/audit. That tool works.
- No new runtime dependency (no Flyway, sqlx-migrate, or node-pg-migrate). A 50-line Node script is enough.
- No migration authoring tools (no `db:make-migration` scaffolder). Files are hand-written SQL — the surface is too small to need one.

## Design

### Directory Layout

```
db/
  migrations/
    entity/
      0001_initial_schema.sql
      0002_revenue_recognition.sql
      0003_withholding_tax_and_bir.sql
      0004_hr_payroll.sql
      0005_budget.sql
      0006_subledger_tagging.sql
```

Filename convention: `NNNN_short_snake_name.sql`. The four-digit prefix defines apply order. Files are applied in lexicographic order — the `0001_` zero-padding guarantees it.

### File Format

Pure `.sql`. Each file contains one or more SQL statements terminated by `;`. The runner parses them properly (see "Statement Parsing" below) — no `;`-split hacks.

Each file MUST be idempotent in the sense that re-running it is safe. Concretely:

- `CREATE TABLE` → `CREATE TABLE IF NOT EXISTS` (current convention).
- `CREATE INDEX` → `CREATE INDEX IF NOT EXISTS` (Postgres 9.5+).
- `ALTER TABLE … ADD COLUMN` → `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (Postgres 9.6+).
- `INSERT …` for seed data → `ON CONFLICT (key) DO NOTHING`.
- `UPDATE` for backfills → must be re-runnable (idempotent `WHERE` clause).

The idempotency guard is a **safety net**, not the primary correctness mechanism. The primary mechanism is the migration tracking table (below). But the guard protects against partial failures and human error.

### Migration Tracking

Each entity schema gets a tracking table:

```sql
CREATE TABLE IF NOT EXISTS "<schemaName>"._migrations (
  name        TEXT        PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The runner records a row per successfully-applied file. To check what's pending:

```sql
SELECT name FROM <schema>._migrations
```

The tracking table lives **inside the entity schema** (not in `public`) because:

- An entity's migration history belongs to that entity. Drop the entity schema, the history goes with it.
- The runner doesn't need to depend on the `public` schema during the apply loop (it does for the entity list, but the apply step is self-contained).
- Trivial to inspect per-entity: `\dt entity_main._migrations`, `SELECT * FROM entity_main._migrations`.

### The Runner

`scripts/migrate-entities.ts` is replaced (or rewritten in place). High-level algorithm:

```
1. files = readdirSync('db/migrations/entity').sort()
2. entities = SELECT id, code, schema_name FROM public.entity ORDER BY code
3. for each entity:
     a. process.stdout.write(`[${code}] ${schema} ... `)
     b. await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
     c. await ensureTrackingTable(schema)
     d. applied = SELECT name FROM ${schema}._migrations  (as a Set<string>)
     e. pending = files.filter(f => !applied.has(f))
     f. if pending.length === 0: print "up to date", continue
     g. for each file in pending:
          - read contents
          - parse into statements (see below)
          - BEGIN
          - for each statement: await prisma.$executeRawUnsafe(stmt)
          - INSERT INTO ${schema}._migrations(name) VALUES($1)
          - COMMIT
          - print "  ✓ <file>"
     h. print "OK (N applied)"
4. print summary: X entities up to date, Y entities migrated (Z files)
```

Exit code 1 if any entity fails. (Same as the current `migrate-entities.ts`.)

### Statement Parsing

The runner needs a real SQL statement splitter, not `;`-split. Approach:

- Strip `-- line comments` (replace `\n--…` with `\n`).
- Strip `/* block comments */`.
- Split on `;` that is **not inside a string literal**.
- A string literal is detected by tracking quote state: `'` opens, next `'` closes (with `''` escape).
- A `$$…$$` dollar-quoted block (Postgres function body) is treated as opaque — but we don't use functions in migrations, so this can be a no-op "if we see `$$`, skip to next `$$;`" escape hatch.

For the migrations we currently have and are likely to write, all statements are simple DDL/DML with no dollar-quoting, no nested strings, and no `;` inside literals. A 40-line splitter is sufficient. (Failing-safe behavior: if the splitter can't parse a file, throw with the file name and line number — never silently drop a statement.)

### What Goes Where

The current `createEntitySchema` SQL (lines 3-955 of `entity-schema.ts`) is split into:

- **`0001_initial_schema.sql`** — `CREATE SCHEMA` (the runner creates it before the file runs, but the file is allowed to assume the schema exists), `CREATE TABLE` for the 14 base tables (`account`, `journal_entry`, `journal_entry_line`, `general_ledger`, `number_series`, `official_receipt`, `official_receipt_line`, `student`, `student_invoice`, `student_invoice_line`, `disbursement`, `vendor_account`, `vendor_invoice`, `fixed_asset`, `depreciation_entry`, `bank_account`, `bank_reconciliation`, `reconciliation_item`, `approval_rule`, `approval_request`, `approval_action`), INSERTs for the chart of accounts and number series.
- **`0002_revenue_recognition.sql`** — `revenue_recognition_entry`, `sales_invoice`, `sales_invoice_line`, and the `student_invoice`/`payment_transaction` column additions (term_start/end, payor_*, payment_type, deposit_status). Currently in `migrateEntitySchema` lines 971-1027.
- **`0003_withholding_tax_and_bir.sql`** — `bir_serial_range`, `withholding_tax_register`, the three `official_receipt.bir_*` column additions. Currently lines 1029-1060.
- **`0004_hr_payroll.sql`** — `employee`, `payroll_run`, `payroll_run_line`. Currently lines 1062-1113.
- **`0005_budget.sql`** — `budget`. Currently lines 1115-1125 + the sub-account INSERTs (21310, 21410, 42000, 42100, 42600, 43000, 43100) and parent_id UPDATEs.
- **`0006_subledger_tagging.sql`** — `account.subledger_type` ALTER, `journal_entry_line.party_type/party_id` ALTERs, and the chart-default UPDATEs. Currently lines 1146-1164.

(The actual cut points may shift slightly when the SQL is reviewed; the principle is "one migration per logical change, named after the change, not the table.")

### Public API

Two functions exported from `src/lib/entity-schema.ts`:

```ts
export async function migrateEntitySchema(schemaName: string): Promise<void>
export async function dropEntitySchema(schemaName: string): Promise<void>
```

- `migrateEntitySchema` becomes a thin wrapper: it calls the runner against the single `schemaName`. (Used by tests and by any code that needs to ensure a specific entity is up to date.)
- `createEntitySchema` is removed. Its single caller (`entity.service.ts`) calls `migrateEntitySchema` instead. The runner handles `CREATE SCHEMA IF NOT EXISTS` for new entities, so no first-time path is needed.
- `dropEntitySchema` is unchanged.

### CLI

```jsonc
// package.json
"db:migrate-entities": "tsx scripts/migrate-entities.ts"
```

Same as today. The script's name and command stay the same; the implementation changes.

(Optional, out of scope for v1: a `db:status` command that prints pending migrations per entity without applying them. Useful for CI. Not blocking.)

### `migrateEntitySchema` as a Programmatic API

`migrateEntitySchema(schemaName)` is still the canonical entry point for non-CLI callers (e.g. integration tests, future ops endpoints). It must:

- Take one `schemaName`.
- Run only against that schema.
- Be idempotent.
- Return when done (or throw on failure).

The CLI runner in `scripts/migrate-entities.ts` calls `migrateEntitySchema` once per entity. No code duplication.

## Error Handling

- **Statement parse failure:** throw with file path + offset. Exit code 1. The runner has not yet started the file, so `_migrations` is untouched. Re-running the script will retry the file.
- **Statement execution failure:** the transaction is rolled back. The file is NOT recorded in `_migrations`. Re-running the script will retry the file from the start.
- **Runner crash mid-file (e.g. process killed):** the transaction is rolled back by Postgres on connection close. `_migrations` is untouched. Re-run is safe.
- **Runner crash AFTER file COMMIT but BEFORE `_migrations` insert:** the file's changes are in the schema, but the row is missing. The next run will try to apply the file again. **This is exactly why the file MUST be idempotent.** The `IF NOT EXISTS` guards make re-application a no-op. The `_migrations` insert then succeeds. (This is the Flyway/sqlx-migrate recovery model.)

## Testing

The existing test suite has 344 passing tests, all of which hit the live database via `migrateEntitySchema`. No test changes are needed — the existing tests are the safety net.

One new unit test: the statement splitter. It is a pure function with no DB dependency, easy to test.

- `parseStatements('-- comment\nA; B;')` → `['A', 'B']`
- `parseStatements("A; 'B;C'; D;")` → `["A", "'B;C'", "D"]`
- `parseStatements("A /* ; */ ; B;")` → `['A', 'B']`

## Rollout / Deploy

- The new runner and migration files are added in one PR.
- `npm run db:migrate-entities` is run once at deploy time.
- For the **3 existing entities** in the live database (`entity_main` and 2 others), the runner sees an empty `_migrations` table on first run, so it applies all 6 migration files. Each file is idempotent (uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`), so re-applying is safe.
- For **new entities** created via the UI/API, the runner creates the schema and applies all 6 files from scratch.
- After rollout, `entity-schema.ts` shrinks from 1177 lines to ~100 lines (the runner + drop + a thin migrateEntitySchema wrapper).

## Open Questions

None for v1. The optional `db:status` command and a `db:make-migration` scaffolder are explicitly deferred.

## Files Touched

- **New:** `db/migrations/entity/0001_initial_schema.sql` … `0006_subledger_tagging.sql` (6 files)
- **Rewritten:** `scripts/migrate-entities.ts`
- **New:** `src/lib/migrations/parser.ts` (SQL statement splitter, ~50 lines)
- **New:** `src/lib/migrations/runner.ts` (~80 lines, exports `migrateEntitySchema`)
- **Modified:** `src/lib/entity-schema.ts` (now imports from `migrations/runner.ts`, removes `createEntitySchema`, shrinks to ~100 lines)
- **Modified:** `src/services/entity.service.ts` (replaces `createEntitySchema` call with `migrateEntitySchema`)
- **New test:** `src/lib/migrations/parser.test.ts`
- **Modified:** `AGENTS.md` (Known Fix #9 trap note is now obsolete; the `;`-split is gone. Add a "Migrations" section.)

## Out of Scope (Captured for Later)

- `prisma migrate` adoption for public/audit (already works, no change).
- Down-migrations (forward-only by design).
- Migration generators (hand-write files; surface too small).
- `db:status` command (deferred).
- Other known bugs from AGENTS.md (`cash-disbursements.service.ts:50` LPAD, cash-receipt form option enum, typecheck baseline, ESLint config crash). Unrelated to this work.
